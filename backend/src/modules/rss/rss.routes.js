import { Router } from 'express'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { AppError, asyncHandler } from '../../utils/errors.js'

const router = Router()

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

router.get(
  '/shows/:id/feed.xml',
  asyncHandler(async (req, res) => {
    const show = await prisma.show.findUnique({
      where: { id: req.params.id },
      include: {
        workspace: true,
        episodes: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploader: { select: { name: true } },
          },
        },
      },
    })

    if (!show || show.workspace.mode !== 'CREATOR') {
      throw new AppError(404, 'Creator show feed not found.', 'NOT_FOUND')
    }

    const baseUrl = env.publicBaseUrl.replace(/\/$/, '')
    const feedUrl = `${baseUrl}/api/shows/${show.id}/feed.xml`

    const itemsXml = show.episodes
      .filter((ep) => ep.sourceType === 'UPLOAD' && ep.audioKey && ep.fileSize)
      .map((ep) => {
        const audioUrl = `${baseUrl}/api/episodes/${ep.id}/audio`
        const pubDate = new Date(ep.createdAt).toUTCString()
        const durationSec = Math.round(ep.duration || 0)

        return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description || ep.title)}</description>
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <enclosure url="${escapeXml(audioUrl)}" length="${ep.fileSize}" type="${escapeXml(ep.mimeType)}" />
      <itunes:author>${escapeXml(ep.uploader?.name || show.author || 'EchoSpace Creator')}</itunes:author>
      <itunes:duration>${durationSec}</itunes:duration>
    </item>`
      })
      .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtd/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(show.title)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(show.description || show.title)}</description>
    <language>${escapeXml(show.language || 'en-us')}</language>
    <itunes:author>${escapeXml(show.author || show.workspace.name)}</itunes:author>
    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`

    res.set('Content-Type', 'application/rss+xml; charset=utf-8')
    res.send(xml)
  })
)

export default router
