import { z } from 'zod'
import { XMLParser } from 'fast-xml-parser'
import { prisma } from '../../config/prisma.js'
import { AppError, asyncHandler } from '../../utils/errors.js'
import {
  assertSafePublicUrl,
  safeFetchText,
  safeInspectRemoteHeaders,
  validateAudioContentType,
} from '../../utils/ssrf.js'
import {
  ALL_ROLES,
  assertWorkspaceMember,
  WRITE_ROLES,
} from '../../middleware/workspaceAuth.js'
import { drainImportQueue } from './imports.worker.js'
import {
  classifySourceUrl,
  resolveAndInspectSource,
  SUPPORTED_AUDIO_FORMATS,
} from './providers.js'
import { canonicalizeSourceUrl } from './resolvers/index.js'
import { emitUserEvent, emitWorkspaceEvent } from '../../sockets/index.js'
import { canonicalizeExternalMediaUrl } from '../../utils/youtube.js'

const MAX_RSS_BYTES = 2 * 1024 * 1024
const MAX_RSS_EPISODES = 50
const MAX_RETRIES = 3
const ACTIVE_STATUSES = [
  'QUEUED',
  'VALIDATING',
  'FETCHING',
  'DOWNLOADING',
  'EXTRACTING',
  'PROCESSING',
  'UPLOADING',
]

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
  force: z.boolean().optional().default(false),
})

export const importRssBatchSchema = z.object({
  workspaceId: z.string().uuid(),
  episodes: z
    .array(
      z.object({
        enclosureUrl: z.string().url(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional().default(''),
        duration: z.coerce.number().min(0).optional().default(0),
      })
    )
    .min(1)
    .max(10),
})

export const importRssEpisodeSchema = z.object({
  workspaceId: z.string().uuid(),
  enclosureUrl: z.string().url(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  duration: z.coerce.number().min(0).optional().default(0),
})

export const inspectSource = asyncHandler(async (req, res) => {
  const { url } = req.body
  const resolved = await resolveAndInspectSource(url)
  const { resolvedUrl: _omitResolved, ...safeSource } = resolved
  res.json({
    source: {
      ...safeSource,
      kind: safeSource.sourceType,
    },
    supportedFormats: SUPPORTED_AUDIO_FORMATS,
  })
})

function parseDurationValue(durRaw) {
  let duration = 0
  if (typeof durRaw === 'number') duration = durRaw
  else if (typeof durRaw === 'string') {
    const parts = durRaw.split(':').map(Number)
    if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2]
    else if (parts.length === 2) duration = parts[0] * 60 + parts[1]
    else if (!Number.isNaN(parts[0])) duration = parts[0]
  }
  return Number.isFinite(duration) ? Math.round(duration) : 0
}

export const previewRss = asyncHandler(async (req, res) => {
  const { url } = req.body
  const classification = classifySourceUrl(url)
  if (classification.kind === 'UNSUPPORTED_STREAMING') {
    throw new AppError(400, classification.message, classification.code)
  }

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
    throw new AppError(
      400,
      "This URL doesn't appear to contain a valid podcast RSS feed.",
      'INVALID_RSS'
    )
  }

  const channel = parsed?.rss?.channel
  const atomFeed = parsed?.feed

  if (!channel && !atomFeed) {
    throw new AppError(
      400,
      "This URL doesn't appear to contain a valid podcast RSS feed.",
      'INVALID_RSS'
    )
  }

  const episodes = []
  if (channel) {
    const rawItems = Array.isArray(channel.item)
      ? channel.item
      : channel.item
        ? [channel.item]
        : []

    for (const item of rawItems.slice(0, MAX_RSS_EPISODES)) {
      const enc = item?.enclosure
      const enclosureUrl = enc?.['@_url'] || enc?.url || ''
      if (!enclosureUrl) continue

      try {
        await assertSafePublicUrl(enclosureUrl)
      } catch {
        continue
      }

      episodes.push({
        title: String(item.title || 'Untitled Episode').slice(0, 200),
        description: String(item.description || '').replace(/<[^>]*>/g, '').slice(0, 600),
        pubDate: item.pubDate || '',
        enclosureUrl,
        mimeType: enc?.['@_type'] || 'audio/mpeg',
        duration: parseDurationValue(item?.['itunes:duration']),
        artwork:
          item?.['itunes:image']?.['@_href'] ||
          channel?.['itunes:image']?.['@_href'] ||
          channel?.image?.url ||
          null,
      })
    }

    return res.json({
      feed: {
        title: String(channel.title || 'Podcast Feed'),
        description: String(channel.description || '').replace(/<[^>]*>/g, '').slice(0, 600),
        artwork:
          channel?.['itunes:image']?.['@_href'] || channel?.image?.url || null,
        episodes,
      },
    })
  }

  // Atom feed support
  const rawEntries = Array.isArray(atomFeed.entry)
    ? atomFeed.entry
    : atomFeed.entry
      ? [atomFeed.entry]
      : []
  for (const entry of rawEntries.slice(0, MAX_RSS_EPISODES)) {
    const links = Array.isArray(entry.link) ? entry.link : entry.link ? [entry.link] : []
    const encLink = links.find((l) => l?.['@_rel'] === 'enclosure' && l?.['@_href'])
    const enclosureUrl = encLink?.['@_href'] || ''
    if (!enclosureUrl) continue
    try {
      await assertSafePublicUrl(enclosureUrl)
    } catch {
      continue
    }
    episodes.push({
      title: String(entry.title?.['#text'] || entry.title || 'Untitled Episode').slice(0, 200),
      description: String(entry.summary?.['#text'] || entry.summary || '')
        .replace(/<[^>]*>/g, '')
        .slice(0, 600),
      pubDate: entry.updated || entry.published || '',
      enclosureUrl,
      mimeType: encLink?.['@_type'] || 'audio/mpeg',
      duration: 0,
      artwork: null,
    })
  }

  res.json({
    feed: {
      title: String(atomFeed.title?.['#text'] || atomFeed.title || 'Podcast Feed'),
      description: String(atomFeed.subtitle?.['#text'] || atomFeed.subtitle || '')
        .replace(/<[^>]*>/g, '')
        .slice(0, 600),
      artwork: null,
      episodes,
    },
  })
})

export const createImport = asyncHandler(async (req, res) => {
  const { workspaceId, url, title, description, tags, force } = req.body
  await assertWorkspaceMember(workspaceId, req.user.id, WRITE_ROLES)

  await assertSafePublicUrl(url)

  const resolved = await resolveAndInspectSource(url)

  const canonical = canonicalizeSourceUrl(url)
  const downloadUrl = resolved.resolvedUrl || url

  if (!force) {
    const existingEpisode = await prisma.episode.findFirst({
      where: {
        workspaceId,
        deletedAt: null,
        sourceUrl: { in: [url, canonical, downloadUrl] },
      },
      select: { id: true, title: true, sourceType: true },
    })
    if (existingEpisode) {
      return res.status(200).json({
        duplicate: true,
        existingEpisode,
        message: 'This episode already exists in your workspace.',
      })
    }
  }

  if (resolved.importability === 'EXTERNAL_LINK') {
    const extCanon = canonicalizeExternalMediaUrl(url)
    if (!force) {
      const existingExt = await prisma.episode.findFirst({
        where: {
          workspaceId,
          deletedAt: null,
          sourceType: 'EXTERNAL_LINK',
          sourceUrl: extCanon.url,
        },
      })
      if (existingExt) {
        return res.status(200).json({
          duplicate: true,
          existingEpisode: existingExt,
          message: 'This external media link already exists in your workspace.',
        })
      }
    }

    const episode = await prisma.episode.create({
      data: {
        workspaceId,
        uploaderId: req.user.id,
        title: title?.trim() || `${resolved.provider} Media`,
        description,
        sourceType: 'EXTERNAL_LINK',
        sourceUrl: extCanon.url,
        duration: 0,
        tags: Array.from(
          new Set([
            ...(tags || []),
            ...(extCanon.provider === 'YOUTUBE' ? ['youtube'] : []),
          ])
        ),
      },
    })
    emitWorkspaceEvent(workspaceId, 'workspace:episode_created', { episode })
    return res.status(201).json({
      mode: 'EXTERNAL_LINK',
      provider: resolved.provider,
      episode,
    })
  }

  if (resolved.importability === 'RSS_PREVIEW') {
    throw new AppError(
      400,
      'This URL points to an RSS or Atom feed, not a direct audio file. Click Preview RSS to import an episode.',
      'RSS_FEED_DETECTED'
    )
  }

  if (resolved.importability !== 'IMPORTABLE' || !resolved.valid) {
    throw new AppError(
      resolved.requiresAuthentication ? 403 : 400,
      resolved.rejectionReason || resolved.message || 'This URL cannot be imported.',
      resolved.code || 'UNSUPPORTED_SOURCE'
    )
  }

  const existingActive = await prisma.importJob.findFirst({
    where: {
      workspaceId,
      sourceUrl: downloadUrl,
      status: { in: ACTIVE_STATUSES },
    },
  })
  if (existingActive) {
    return res.status(200).json({ job: existingActive, deduplicated: true })
  }

  const job = await prisma.importJob.create({
    data: {
      workspaceId,
      userId: req.user.id,
      sourceUrl: downloadUrl,
      sourceKind: resolved.sourceType || 'DIRECT_AUDIO',
      title: title?.trim() || pathTitleFromUrl(url),
      status: 'QUEUED',
      progress: 0,
      metadata: {
        description,
        tags,
        retryCount: 0,
        provider: resolved.provider,
        originalUrl: url,
      },
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
      status: { in: ACTIVE_STATUSES },
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

export const importRssBatch = asyncHandler(async (req, res) => {
  const { workspaceId, episodes } = req.body
  await assertWorkspaceMember(workspaceId, req.user.id, WRITE_ROLES)

  const jobs = []
  for (const ep of episodes) {
    await assertSafePublicUrl(ep.enclosureUrl)
    const existingActive = await prisma.importJob.findFirst({
      where: {
        workspaceId,
        sourceUrl: ep.enclosureUrl,
        status: { in: ACTIVE_STATUSES },
      },
    })
    if (existingActive) {
      jobs.push(existingActive)
      continue
    }
    const job = await prisma.importJob.create({
      data: {
        workspaceId,
        userId: req.user.id,
        sourceUrl: ep.enclosureUrl,
        sourceKind: 'RSS_EPISODE',
        title: ep.title.trim(),
        status: 'QUEUED',
        progress: 0,
        metadata: {
          description: ep.description || '',
          duration: ep.duration || 0,
          retryCount: 0,
        },
      },
    })
    jobs.push(job)
  }

  drainImportQueue().catch(() => {})
  res.status(202).json({ jobs })
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

  if (existing.metadata?.retryable === false) {
    throw new AppError(
      400,
      existing.error || 'This source cannot be retried. Please provide a direct audio URL or RSS feed.',
      'NON_RETRYABLE_IMPORT'
    )
  }

  const currentRetries = Number(existing.metadata?.retryCount || 0)
  if (currentRetries >= MAX_RETRIES) {
    throw new AppError(
      400,
      `Maximum retry limit (${MAX_RETRIES}) reached for this import job.`,
      'MAX_RETRIES_EXCEEDED'
    )
  }

  const nextMeta = {
    ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
    retryCount: currentRetries + 1,
  }

  const job = await prisma.importJob.update({
    where: { id: existing.id },
    data: { status: 'QUEUED', progress: 0, error: null, metadata: nextMeta },
  })
  emitUserEvent(job.userId, 'import:updated', { job })
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
  emitUserEvent(job.userId, 'import:updated', { job })
  res.json({ job })
})
