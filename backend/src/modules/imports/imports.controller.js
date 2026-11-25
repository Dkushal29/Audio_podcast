import { z } from 'zod'
import { XMLParser } from 'fast-xml-parser'
import { prisma } from '../../config/prisma.js'
import { AppError, asyncHandler } from '../../utils/errors.js'
import { assertSafePublicUrl, safeFetchText } from '../../utils/ssrf.js'
import {
  ALL_ROLES,
  assertWorkspaceMember,
  WRITE_ROLES,
} from '../../middleware/workspaceAuth.js'
import { drainImportQueue } from './imports.worker.js'

const MAX_RSS_BYTES = 2 * 1024 * 1024
const MAX_RSS_EPISODES = 50

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: false, // XXE & entity-expansion protection
})

function isProviderEmbedUrl(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase()
    return (
      host.includes('youtube.com') ||
      host.includes('youtu.be') ||
      host.includes('vimeo.com') ||
      host.includes('spotify.com')
    )
  } catch {
    return false
  }
}

export const previewRssSchema = z.object({
  url: z.string().url(),
})

export const createImportSchema = z.object({
  workspaceId: z.string().uuid(),
  url: z.string().url(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().default(''),
  tags: z.array(z.string()).optional().default([]),
})

export const importRssEpisodeSchema = z.object({
  workspaceId: z.string().uuid(),
  enclosureUrl: z.string().url(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  duration: z.coerce.number().min(0).optional().default(0),
})

export const previewRss = asyncHandler(async (req, res) => {
  const { url } = req.body
  const text = await safeFetchText(url, {
    maxBytes: MAX_RSS_BYTES,
    timeoutMs: 12000,
  })
  if (Buffer.byteLength(text, 'utf8') > MAX_RSS_BYTES) {
    throw new AppError(413, 'RSS feed exceeds 2 MB limit.', 'RSS_TOO_LARGE')
  }

  let parsed
  try {
    parsed = xmlParser.parse(text)
  } catch {
    throw new AppError(400, 'Malformed RSS XML feed.', 'INVALID_RSS')
  }

  const channel = parsed?.rss?.channel
  if (!channel) {
    throw new AppError(400, 'No valid RSS 2.0 <channel> found.', 'INVALID_RSS')
  }

  const rawItems = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : []

  const episodes = []
  for (const item of rawItems.slice(0, MAX_RSS_EPISODES)) {
    const enc = item?.enclosure
    const enclosureUrl = enc?.['@_url'] || enc?.url || ''
    if (!enclosureUrl) continue

    try {
      await assertSafePublicUrl(enclosureUrl)
    } catch {
      continue
    }

    const durRaw = item?.['itunes:duration']
    let duration = 0
    if (typeof durRaw === 'number') duration = durRaw
    else if (typeof durRaw === 'string') {
      const parts = durRaw.split(':').map(Number)
      if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2]
      else if (parts.length === 2) duration = parts[0] * 60 + parts[1]
      else if (!Number.isNaN(parts[0])) duration = parts[0]
    }

    episodes.push({
      title: String(item.title || 'Untitled Episode').slice(0, 200),
      description: String(item.description || '').replace(/<[^>]*>/g, '').slice(0, 600),
      pubDate: item.pubDate || '',
      enclosureUrl,
      mimeType: enc?.['@_type'] || 'audio/mpeg',
      duration: Number.isFinite(duration) ? Math.round(duration) : 0,
    })
  }

  res.json({
    feed: {
      title: String(channel.title || 'Podcast Feed'),
      description: String(channel.description || '').replace(/<[^>]*>/g, '').slice(0, 600),
      episodes,
    },
  })
})

export const createImport = asyncHandler(async (req, res) => {
  const { workspaceId, url, title, description, tags } = req.body
  await assertWorkspaceMember(workspaceId, req.user.id, WRITE_ROLES)

  await assertSafePublicUrl(url)

  if (isProviderEmbedUrl(url)) {
    // External provider links are stored as EXTERNAL_LINK without unauthorized downloading
    const episode = await prisma.episode.create({
      data: {
        workspaceId,
        uploaderId: req.user.id,
        title: title?.trim() || `External Media (${new URL(url).hostname})`,
        description,
        sourceType: 'EXTERNAL_LINK',
        sourceUrl: url,
        duration: 0,
        tags,
      },
    })
    return res.status(201).json({
      mode: 'EXTERNAL_LINK',
      episode,
    })
  }

  const existingActive = await prisma.importJob.findFirst({
    where: {
      workspaceId,
      sourceUrl: url,
      status: { in: ['QUEUED', 'PROCESSING'] },
    },
  })
  if (existingActive) {
    return res.status(200).json({ job: existingActive, deduplicated: true })
  }

  const job = await prisma.importJob.create({
    data: {
      workspaceId,
      userId: req.user.id,
      sourceUrl: url,
      sourceKind: 'DIRECT_AUDIO',
      title: title?.trim() || pathTitleFromUrl(url),
      status: 'QUEUED',
      progress: 0,
      metadata: { description, tags },
    },
  })

  drainImportQueue().catch(() => {})
  res.status(202).json({ job })
})

function pathTitleFromUrl(rawUrl) {
  try {
    const pathname = new URL(rawUrl).pathname
    const base = pathname.split('/').filter(Boolean).pop() || 'Imported Audio'
    return decodeURIComponent(base).replace(/\.[^/.]+$/, '').slice(0, 120)
  } catch {
    return 'Imported Audio'
  }
}

export const importRssEpisode = asyncHandler(async (req, res) => {
  const { workspaceId, enclosureUrl, title, description, duration } = req.body
  await assertWorkspaceMember(workspaceId, req.user.id, WRITE_ROLES)
  await assertSafePublicUrl(enclosureUrl)

  const existingActive = await prisma.importJob.findFirst({
    where: {
      workspaceId,
      sourceUrl: enclosureUrl,
      status: { in: ['QUEUED', 'PROCESSING'] },
    },
  })
  if (existingActive) {
    return res.status(200).json({ job: existingActive, deduplicated: true })
  }

  const job = await prisma.importJob.create({
    data: {
      workspaceId,
      userId: req.user.id,
      sourceUrl: enclosureUrl,
      sourceKind: 'RSS_EPISODE',
      title: title.trim(),
      status: 'QUEUED',
      progress: 0,
      metadata: { description, duration },
    },
  })

  drainImportQueue().catch(() => {})
  res.status(202).json({ job })
})

export const getImportJob = asyncHandler(async (req, res) => {
  const job = await prisma.importJob.findUnique({ where: { id: req.params.id } })
  if (!job) throw new AppError(404, 'Import job not found.', 'NOT_FOUND')
  await assertWorkspaceMember(job.workspaceId, req.user.id, ALL_ROLES)
  res.json({ job })
})

export const listWorkspaceImports = asyncHandler(async (req, res) => {
  await assertWorkspaceMember(req.params.id, req.user.id, ALL_ROLES)
  const jobs = await prisma.importJob.findMany({
    where: { workspaceId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 25,
  })
  res.json({ jobs })
})

export const retryImportJob = asyncHandler(async (req, res) => {
  const existing = await prisma.importJob.findUnique({ where: { id: req.params.id } })
  if (!existing) throw new AppError(404, 'Import job not found.', 'NOT_FOUND')
  await assertWorkspaceMember(existing.workspaceId, req.user.id, WRITE_ROLES)

  const job = await prisma.importJob.update({
    where: { id: existing.id },
    data: { status: 'QUEUED', progress: 0, error: null },
  })
  drainImportQueue().catch(() => {})
  res.json({ job })
})

export const cancelImportJob = asyncHandler(async (req, res) => {
  const existing = await prisma.importJob.findUnique({ where: { id: req.params.id } })
  if (!existing) throw new AppError(404, 'Import job not found.', 'NOT_FOUND')
  await assertWorkspaceMember(existing.workspaceId, req.user.id, WRITE_ROLES)

  const job = await prisma.importJob.update({
    where: { id: existing.id },
    data: { status: 'CANCELLED' },
  })
  res.json({ job })
})
