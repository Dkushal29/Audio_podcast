import {
  assertSafePublicUrl,
  safeFetchHtmlSnippet,
  safeFetchText,
  safeInspectRemoteHeaders,
  validateAudioContentType,
} from '../../../utils/ssrf.js'

const AUDIO_EXT_RE = /\.(mp3|wav|ogg|opus|m4a|aac|flac|webm)(\?.*)?$/i
const VIDEO_EXT_RE = /\.(mp4|mov|m4v|mkv)(\?.*)?$/i
const RSS_HINT_RE = /(\.xml|\.rss|\/feed\/?$|\/rss\/?$|feed=|format=rss)/i

const UNSUPPORTED_STREAMING_PROVIDERS = [
  { name: 'Gaana', hosts: ['gaana.com'] },
  { name: 'JioSaavn', hosts: ['jiosaavn.com', 'saavn.com'] },
  { name: 'Wynk Music', hosts: ['wynk.in'] },
  { name: 'Apple Music', hosts: ['music.apple.com'] },
  { name: 'Amazon Music', hosts: ['music.amazon.com', 'music.amazon.in'] },
  { name: 'Tidal', hosts: ['tidal.com'] },
  { name: 'Deezer', hosts: ['deezer.com'] },
  { name: 'Pandora', hosts: ['pandora.com'] },
  { name: 'Spotify', hosts: ['open.spotify.com', 'spotify.com'] },
]

const EMBED_PROVIDERS = [
  { name: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { name: 'Vimeo', hosts: ['vimeo.com'] },
  { name: 'SoundCloud', hosts: ['soundcloud.com'] },
]

const FULL_AUDIO_CAPABILITIES = {
  audioPlayback: true,
  waveform: true,
  transcription: true,
  annotations: true,
  clips: true,
  chapters: true,
}

const EXTERNAL_LINK_CAPABILITIES = {
  audioPlayback: false,
  waveform: false,
  transcription: false,
  annotations: true,
  clips: true,
  chapters: true,
}

const DEFAULT_ALTERNATIVES = [
  'Upload an audio file directly from your device',
  'Paste a direct downloadable audio or video URL',
  'Paste a podcast show page or RSS/Atom feed URL',
  'Share a public Google Drive, Dropbox, or OneDrive link',
]

function hostMatches(host, candidate) {
  return host === candidate || host.endsWith(`.${candidate}`)
}

export function canonicalizeSourceUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    u.hash = ''
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach(
      (p) => u.searchParams.delete(p)
    )
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1)
    }
    return u.toString()
  } catch {
    return rawUrl
  }
}

export function discoverRssFromHtml(html, baseUrl) {
  if (!html || typeof html !== 'string') return null
  const linkTags = html.match(/<link\b[^>]*>/gi) || []
  for (const tag of linkTags) {
    const typeMatch = tag.match(/type\s*=\s*["']([^"']+)["']/i)
    const relMatch = tag.match(/rel\s*=\s*["']([^"']+)["']/i)
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i)
    if (!hrefMatch) continue
    const type = (typeMatch?.[1] || '').toLowerCase()
    const rel = (relMatch?.[1] || '').toLowerCase()
    if (
      rel.includes('alternate') &&
      (type.includes('rss+xml') || type.includes('atom+xml') || type.includes('xml'))
    ) {
      try {
        return new URL(hrefMatch[1], baseUrl).toString()
      } catch {
        continue
      }
    }
  }
  return null
}

function extractTitleFromHtml(html) {
  const m = String(html || '').match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? m[1].trim().slice(0, 180) : null
}

function buildResult(overrides) {
  return {
    sourceType: 'UNKNOWN_SOURCE',
    provider: 'generic',
    statusLabel: 'Unknown Source',
    originalUrl: '',
    resolvedUrl: null,
    feedUrl: null,
    title: null,
    description: null,
    mediaType: 'unknown',
    contentType: null,
    duration: null,
    fileSize: null,
    importSupported: false,
    importability: 'UNSUPPORTED',
    requiresAuthentication: false,
    requiresUserAction: false,
    suggestedAction: 'UPLOAD_FILE',
    capabilities: EXTERNAL_LINK_CAPABILITIES,
    rejectionReason: null,
    code: null,
    retryable: false,
    alternatives: [],
    valid: false,
    supportedForDownload: false,
    message: '',
    ...overrides,
  }
}

export const UnsupportedSourceProvider = {
  id: 'unsupported-streaming',
  name: 'Unsupported Streaming Platform',
  priority: 10,
  matches(parsed) {
    const host = parsed.hostname.toLowerCase()
    return UNSUPPORTED_STREAMING_PROVIDERS.find((p) =>
      p.hosts.some((h) => hostMatches(host, h))
    )
  },
  classify(rawUrl, parsed) {
    const match = this.matches(parsed)
    const msg =
      'This source uses protected streaming and cannot be directly imported.'
    return buildResult({
      sourceType: 'UNSUPPORTED_STREAMING',
      provider: match.name,
      statusLabel: 'Unsupported Streaming Platform',
      originalUrl: rawUrl,
      mediaType: 'stream',
      importSupported: false,
      importability: 'UNSUPPORTED',
      suggestedAction: 'EXTERNAL_LINK_OR_UPLOAD',
      capabilities: EXTERNAL_LINK_CAPABILITIES,
      rejectionReason: msg,
      code: 'UNSUPPORTED_STREAMING_SOURCE',
      retryable: false,
      alternatives: DEFAULT_ALTERNATIVES,
      valid: false,
      supportedForDownload: false,
      message: msg,
    })
  },
  async inspect(rawUrl, parsed) {
    return this.classify(rawUrl, parsed)
  },
}

export const OfficialPlatformIntegrationProvider = {
  id: 'official-embed',
  name: 'External Media Link',
  priority: 20,
  matches(parsed) {
    const host = parsed.hostname.toLowerCase()
    return EMBED_PROVIDERS.find((p) =>
      p.hosts.some((h) => hostMatches(host, h))
    )
  },
  classify(rawUrl, parsed) {
    const match = this.matches(parsed)
    const msg = `${match.name} links are saved as External Link episodes with timestamped annotations (direct stream downloading is not performed).`
    return buildResult({
      sourceType: 'EXTERNAL_LINK_ONLY',
      provider: match.name,
      statusLabel: `${match.name} External Link`,
      originalUrl: rawUrl,
      resolvedUrl: rawUrl,
      mediaType: 'external',
      importSupported: true,
      importability: 'EXTERNAL_LINK',
      suggestedAction: 'SAVE_EXTERNAL_LINK',
      capabilities: EXTERNAL_LINK_CAPABILITIES,
      retryable: false,
      valid: true,
      supportedForDownload: false,
      message: msg,
    })
  },
  async inspect(rawUrl, parsed) {
    return this.classify(rawUrl, parsed)
  },
}

export const ApplePodcastsProvider = {
  id: 'apple-podcasts',
  name: 'Apple Podcasts',
  priority: 25,
  matches(parsed) {
    const host = parsed.hostname.toLowerCase()
    return hostMatches(host, 'podcasts.apple.com') && /\/id(\d+)/.test(parsed.pathname)
  },
  classify(rawUrl) {
    return buildResult({
      sourceType: 'PODCAST_SHOW_PAGE',
      provider: 'Apple Podcasts',
      statusLabel: 'Podcast Show Detected',
      originalUrl: rawUrl,
      mediaType: 'podcast',
      importSupported: true,
      importability: 'RSS_PREVIEW',
      suggestedAction: 'BROWSE_EPISODES',
      capabilities: FULL_AUDIO_CAPABILITIES,
      retryable: true,
      valid: true,
      supportedForDownload: true,
      message: 'Apple Podcasts show detected. Looking up public RSS feed...',
    })
  },
  async inspect(rawUrl, parsed, ctx = {}) {
    const base = this.classify(rawUrl)
    const idMatch = parsed.pathname.match(/\/id(\d+)/)
    if (!idMatch) return base
    const fetchText = ctx.fetchText || safeFetchText
    try {
      const jsonText = await fetchText(
        `https://itunes.apple.com/lookup?id=${idMatch[1]}&entity=podcast`,
        { maxBytes: 512 * 1024, timeoutMs: 8000 }
      )
      const data = JSON.parse(jsonText)
      const podcast = data?.results?.[0]
      if (podcast?.feedUrl) {
        await (ctx.assertSafePublicUrl || assertSafePublicUrl)(podcast.feedUrl)
        return buildResult({
          ...base,
          feedUrl: podcast.feedUrl,
          resolvedUrl: podcast.feedUrl,
          title: podcast.collectionName || podcast.trackName || null,
          message: 'Podcast show detected. Select episodes to import.',
        })
      }
    } catch {
      // Fallback below
    }
    return buildResult({
      ...base,
      importSupported: false,
      importability: 'UNSUPPORTED',
      suggestedAction: 'UPLOAD_FILE',
      valid: false,
      supportedForDownload: false,
      rejectionReason: 'Could not discover a public RSS feed for this Apple Podcasts show.',
      message: 'Could not discover a public RSS feed for this Apple Podcasts show.',
    })
  },
}

export function extractGoogleDriveFileId(parsed) {
  const host = parsed.hostname.toLowerCase()
  if (!hostMatches(host, 'drive.google.com')) return null
  const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return fileMatch[1]
  const idParam = parsed.searchParams.get('id')
  if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) return idParam
  return null
}

export const GoogleDriveProvider = {
  id: 'google-drive',
  name: 'Google Drive',
  priority: 30,
  matches(parsed) {
    return Boolean(extractGoogleDriveFileId(parsed))
  },
  classify(rawUrl, parsed) {
    const fileId = extractGoogleDriveFileId(parsed)
    const resolvedUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
    return buildResult({
      sourceType: 'PUBLIC_CLOUD_FILE',
      provider: 'Google Drive',
      statusLabel: 'Google Drive File',
      originalUrl: rawUrl,
      resolvedUrl,
      mediaType: 'audio',
      importSupported: true,
      importability: 'IMPORTABLE',
      suggestedAction: 'IMPORT',
      capabilities: FULL_AUDIO_CAPABILITIES,
      retryable: true,
      valid: true,
      supportedForDownload: true,
      message: 'Google Drive file detected. Checking public download access...',
    })
  },
  async inspect(rawUrl, parsed, ctx = {}) {
    const base = this.classify(rawUrl, parsed)
    const inspectHeaders = ctx.inspectHeaders || safeInspectRemoteHeaders
    try {
      const headers = await inspectHeaders(base.resolvedUrl)
      const ct = String(headers.contentType || '').split(';')[0].trim().toLowerCase()
      if (ct === 'text/html' || ct === 'application/xhtml+xml') {
        const msg =
          'This file is not publicly downloadable. Set Google Drive sharing to "Anyone with the link" or upload the file directly.'
        return buildResult({
          ...base,
          sourceType: 'AUTH_REQUIRED',
          statusLabel: 'Authentication Required',
          importSupported: false,
          importability: 'REQUIRES_AUTH',
          requiresAuthentication: true,
          requiresUserAction: true,
          suggestedAction: 'CHANGE_PERMISSIONS_OR_UPLOAD',
          capabilities: EXTERNAL_LINK_CAPABILITIES,
          rejectionReason: msg,
          code: 'CLOUD_AUTH_REQUIRED',
          retryable: false,
          alternatives: DEFAULT_ALTERNATIVES,
          valid: false,
          supportedForDownload: false,
          message: msg,
        })
      }
      const ctCheck = validateAudioContentType(headers.contentType)
      return buildResult({
        ...base,
        mediaType: ctCheck.kind === 'DIRECT_VIDEO' ? 'video' : 'audio',
        suggestedAction: ctCheck.kind === 'DIRECT_VIDEO' ? 'EXTRACT_AND_IMPORT' : 'IMPORT',
        contentType: headers.contentType || null,
        fileSize: headers.contentLength || null,
        message: 'Public Google Drive media file verified and ready to import.',
      })
    } catch (err) {
      return buildResult({
        ...base,
        sourceType: err.code === 'ACCESS_DENIED' ? 'AUTH_REQUIRED' : 'INVALID_URL',
        importSupported: false,
        importability: err.code === 'ACCESS_DENIED' ? 'REQUIRES_AUTH' : 'UNSUPPORTED',
        statusLabel: err.code === 'ACCESS_DENIED' ? 'Authentication Required' : 'Invalid Source',
        requiresAuthentication: err.code === 'ACCESS_DENIED',
        suggestedAction: 'CHANGE_PERMISSIONS_OR_UPLOAD',
        capabilities: EXTERNAL_LINK_CAPABILITIES,
        rejectionReason: err.message,
        code: err.code || 'DRIVE_INSPECT_FAILED',
        retryable: false,
        alternatives: DEFAULT_ALTERNATIVES,
        valid: false,
        supportedForDownload: false,
        message: err.message,
      })
    }
  },
}

export function resolveDropboxUrl(parsed) {
  const next = new URL(parsed.toString())
  next.searchParams.set('dl', '1')
  return next.toString()
}

export const DropboxProvider = {
  id: 'dropbox',
  name: 'Dropbox',
  priority: 35,
  matches(parsed) {
    const host = parsed.hostname.toLowerCase()
    return (
      hostMatches(host, 'dropbox.com') ||
      hostMatches(host, 'dl.dropboxusercontent.com')
    )
  },
  classify(rawUrl, parsed) {
    const resolvedUrl = resolveDropboxUrl(parsed)
    return buildResult({
      sourceType: 'PUBLIC_CLOUD_FILE',
      provider: 'Dropbox',
      statusLabel: 'Dropbox File',
      originalUrl: rawUrl,
      resolvedUrl,
      mediaType: 'audio',
      importSupported: true,
      importability: 'IMPORTABLE',
      suggestedAction: 'IMPORT',
      capabilities: FULL_AUDIO_CAPABILITIES,
      retryable: true,
      valid: true,
      supportedForDownload: true,
      message: 'Dropbox link detected. Verifying direct media download...',
    })
  },
  async inspect(rawUrl, parsed, ctx = {}) {
    const base = this.classify(rawUrl, parsed)
    const inspectHeaders = ctx.inspectHeaders || safeInspectRemoteHeaders
    try {
      const headers = await inspectHeaders(base.resolvedUrl)
      const ctCheck = validateAudioContentType(headers.contentType)
      return buildResult({
        ...base,
        mediaType: ctCheck.kind === 'DIRECT_VIDEO' ? 'video' : 'audio',
        suggestedAction: ctCheck.kind === 'DIRECT_VIDEO' ? 'EXTRACT_AND_IMPORT' : 'IMPORT',
        contentType: headers.contentType || null,
        fileSize: headers.contentLength || null,
        message: 'Public Dropbox media file verified and ready to import.',
      })
    } catch (err) {
      const needsAuth = err.code === 'ACCESS_DENIED' || err.code === 'UNSUPPORTED_WEBPAGE'
      const msg =
        err.code === 'UNSUPPORTED_WEBPAGE'
          ? 'This file is not publicly downloadable. It points to a Dropbox preview or sign-in page.'
          : err.message
      return buildResult({
        ...base,
        sourceType: needsAuth ? 'AUTH_REQUIRED' : 'INVALID_URL',
        importSupported: false,
        importability: needsAuth ? 'REQUIRES_AUTH' : 'UNSUPPORTED',
        statusLabel: needsAuth ? 'Authentication Required' : 'Invalid Source',
        requiresAuthentication: err.code === 'ACCESS_DENIED',
        suggestedAction: 'CHANGE_PERMISSIONS_OR_UPLOAD',
        capabilities: EXTERNAL_LINK_CAPABILITIES,
        rejectionReason: msg,
        code: err.code || 'DROPBOX_INSPECT_FAILED',
        retryable: false,
        alternatives: DEFAULT_ALTERNATIVES,
        valid: false,
        supportedForDownload: false,
        message: msg,
      })
    }
  },
}

export function resolveOneDriveUrl(parsed) {
  const next = new URL(parsed.toString())
  if (hostMatches(next.hostname.toLowerCase(), 'onedrive.live.com')) {
    next.searchParams.set('download', '1')
  }
  return next.toString()
}

export const OneDriveProvider = {
  id: 'onedrive',
  name: 'OneDrive',
  priority: 40,
  matches(parsed) {
    const host = parsed.hostname.toLowerCase()
    return (
      hostMatches(host, '1drv.ms') ||
      hostMatches(host, 'onedrive.live.com') ||
      host.endsWith('.sharepoint.com')
    )
  },
  classify(rawUrl, parsed) {
    const resolvedUrl = resolveOneDriveUrl(parsed)
    return buildResult({
      sourceType: 'PUBLIC_CLOUD_FILE',
      provider: 'OneDrive',
      statusLabel: 'OneDrive File',
      originalUrl: rawUrl,
      resolvedUrl,
      mediaType: 'audio',
      importSupported: true,
      importability: 'IMPORTABLE',
      suggestedAction: 'IMPORT',
      capabilities: FULL_AUDIO_CAPABILITIES,
      retryable: true,
      valid: true,
      supportedForDownload: true,
      message: 'OneDrive link detected. Verifying public media access...',
    })
  },
  async inspect(rawUrl, parsed, ctx = {}) {
    const base = this.classify(rawUrl, parsed)
    const inspectHeaders = ctx.inspectHeaders || safeInspectRemoteHeaders
    try {
      const headers = await inspectHeaders(base.resolvedUrl)
      const ctCheck = validateAudioContentType(headers.contentType)
      return buildResult({
        ...base,
        mediaType: ctCheck.kind === 'DIRECT_VIDEO' ? 'video' : 'audio',
        suggestedAction: ctCheck.kind === 'DIRECT_VIDEO' ? 'EXTRACT_AND_IMPORT' : 'IMPORT',
        contentType: headers.contentType || null,
        fileSize: headers.contentLength || null,
        message: 'Public OneDrive media file verified and ready to import.',
      })
    } catch (err) {
      const needsAuth = err.code === 'ACCESS_DENIED' || err.code === 'UNSUPPORTED_WEBPAGE'
      const msg =
        err.code === 'ACCESS_DENIED' || err.code === 'UNSUPPORTED_WEBPAGE'
          ? 'This file is not publicly downloadable. Share it publicly or upload the file directly.'
          : err.message
      return buildResult({
        ...base,
        sourceType: needsAuth ? 'AUTH_REQUIRED' : 'INVALID_URL',
        importSupported: false,
        importability: needsAuth ? 'REQUIRES_AUTH' : 'UNSUPPORTED',
        statusLabel: needsAuth ? 'Authentication Required' : 'Invalid Source',
        requiresAuthentication: true,
        suggestedAction: 'CHANGE_PERMISSIONS_OR_UPLOAD',
        capabilities: EXTERNAL_LINK_CAPABILITIES,
        rejectionReason: msg,
        code: err.code || 'ONEDRIVE_INSPECT_FAILED',
        retryable: false,
        alternatives: DEFAULT_ALTERNATIVES,
        valid: false,
        supportedForDownload: false,
        message: msg,
      })
    }
  },
}

export const PodcastRSSProvider = {
  id: 'podcast-rss',
  name: 'Podcast RSS',
  priority: 50,
  matches(parsed) {
    return RSS_HINT_RE.test(parsed.pathname + parsed.search)
  },
  classify(rawUrl) {
    return buildResult({
      sourceType: 'PODCAST_RSS',
      provider: 'Podcast RSS',
      statusLabel: 'Podcast Feed Detected',
      originalUrl: rawUrl,
      resolvedUrl: rawUrl,
      feedUrl: rawUrl,
      mediaType: 'podcast',
      importSupported: true,
      importability: 'RSS_PREVIEW',
      suggestedAction: 'BROWSE_EPISODES',
      capabilities: FULL_AUDIO_CAPABILITIES,
      retryable: true,
      valid: true,
      supportedForDownload: true,
      message: 'Podcast RSS/Atom feed detected. Browse episodes to import.',
    })
  },
  async inspect(rawUrl) {
    return this.classify(rawUrl)
  },
}

export const DirectVideoProvider = {
  id: 'direct-video',
  name: 'Direct Video',
  priority: 55,
  matches(parsed) {
    return VIDEO_EXT_RE.test(parsed.pathname + parsed.search)
  },
  classify(rawUrl) {
    return buildResult({
      sourceType: 'DIRECT_VIDEO',
      provider: 'Direct Video',
      statusLabel: 'Direct Video Detected',
      originalUrl: rawUrl,
      resolvedUrl: rawUrl,
      mediaType: 'video',
      importSupported: true,
      importability: 'IMPORTABLE',
      suggestedAction: 'EXTRACT_AND_IMPORT',
      capabilities: FULL_AUDIO_CAPABILITIES,
      retryable: true,
      valid: true,
      supportedForDownload: true,
      message: 'Video detected. Audio can be extracted from this media.',
    })
  },
  async inspect(rawUrl, parsed, ctx = {}) {
    const base = this.classify(rawUrl)
    const inspectHeaders = ctx.inspectHeaders || safeInspectRemoteHeaders
    try {
      const headers = await inspectHeaders(rawUrl)
      validateAudioContentType(headers.contentType)
      return buildResult({
        ...base,
        contentType: headers.contentType || null,
        fileSize: headers.contentLength || null,
      })
    } catch (err) {
      return buildResult({
        ...base,
        sourceType: err.code === 'UNSUPPORTED_WEBPAGE' ? 'UNKNOWN_SOURCE' : 'INVALID_URL',
        importSupported: false,
        importability: 'UNSUPPORTED',
        statusLabel: 'Invalid Source',
        suggestedAction: 'UPLOAD_FILE',
        capabilities: EXTERNAL_LINK_CAPABILITIES,
        rejectionReason: err.message,
        code: err.code || 'INSPECT_FAILED',
        retryable: false,
        alternatives: DEFAULT_ALTERNATIVES,
        valid: false,
        supportedForDownload: false,
        message: err.message,
      })
    }
  },
}

export const GenericPublicMediaProvider = {
  id: 'direct-audio',
  name: 'generic',
  priority: 60,
  matches() {
    return true
  },
  classify(rawUrl, parsed) {
    const hasExt = AUDIO_EXT_RE.test(parsed.pathname + parsed.search)
    return buildResult({
      sourceType: hasExt ? 'DIRECT_AUDIO' : 'EXTENSIONLESS_MEDIA',
      provider: 'generic',
      statusLabel: hasExt ? 'Direct Audio Detected' : 'Public Media Source',
      originalUrl: rawUrl,
      resolvedUrl: rawUrl,
      mediaType: 'audio',
      importSupported: true,
      importability: 'IMPORTABLE',
      suggestedAction: 'IMPORT',
      capabilities: FULL_AUDIO_CAPABILITIES,
      retryable: true,
      valid: true,
      supportedForDownload: true,
      message: hasExt
        ? 'Audio file detected. Ready to import.'
        : 'Checking remote URL headers for supported media or podcast RSS...',
    })
  },
  async inspect(rawUrl, parsed, ctx = {}) {
    const base = this.classify(rawUrl, parsed)
    const inspectHeaders = ctx.inspectHeaders || safeInspectRemoteHeaders
    const fetchHtml = ctx.fetchHtmlSnippet || safeFetchHtmlSnippet
    try {
      const headers = await inspectHeaders(rawUrl)
      const ctCheck = validateAudioContentType(headers.contentType)
      if (!ctCheck.ok && ctCheck.kind === 'RSS_FEED') {
        return buildResult({
          sourceType: 'PODCAST_RSS',
          provider: 'Podcast RSS',
          statusLabel: 'Podcast Feed Detected',
          originalUrl: rawUrl,
          resolvedUrl: rawUrl,
          feedUrl: rawUrl,
          mediaType: 'podcast',
          contentType: headers.contentType || null,
          importSupported: true,
          importability: 'RSS_PREVIEW',
          suggestedAction: 'BROWSE_EPISODES',
          capabilities: FULL_AUDIO_CAPABILITIES,
          retryable: true,
          valid: true,
          supportedForDownload: true,
          message: 'Podcast RSS/Atom feed detected. Browse episodes to import.',
        })
      }

      if (ctCheck.kind === 'DIRECT_VIDEO') {
        return buildResult({
          ...base,
          sourceType: 'DIRECT_VIDEO',
          statusLabel: 'Direct Video Detected',
          mediaType: 'video',
          suggestedAction: 'EXTRACT_AND_IMPORT',
          contentType: headers.contentType || null,
          fileSize: headers.contentLength || null,
          message: 'Video detected. Audio can be extracted from this media.',
        })
      }

      return buildResult({
        ...base,
        statusLabel:
          base.sourceType === 'EXTENSIONLESS_MEDIA'
            ? 'Public Media Source'
            : 'Direct Audio Detected',
        contentType: headers.contentType || null,
        fileSize: headers.contentLength || null,
        message: 'Audio file detected. Ready to import.',
      })
    } catch (err) {
      // If webpage, attempt RSS <link rel="alternate"> discovery for podcast show pages
      if (err.code === 'UNSUPPORTED_WEBPAGE') {
        try {
          const { html, finalUrl } = await fetchHtml(rawUrl)
          const discoveredFeed = discoverRssFromHtml(html, finalUrl || rawUrl)
          if (discoveredFeed) {
            await (ctx.assertSafePublicUrl || assertSafePublicUrl)(discoveredFeed)
            return buildResult({
              sourceType: 'PODCAST_SHOW_PAGE',
              provider: 'Podcast Show',
              statusLabel: 'Podcast Show Detected',
              originalUrl: rawUrl,
              resolvedUrl: discoveredFeed,
              feedUrl: discoveredFeed,
              title: extractTitleFromHtml(html),
              mediaType: 'podcast',
              importSupported: true,
              importability: 'RSS_PREVIEW',
              suggestedAction: 'BROWSE_EPISODES',
              capabilities: FULL_AUDIO_CAPABILITIES,
              retryable: true,
              valid: true,
              supportedForDownload: true,
              message: 'Podcast show detected. Select episodes to import.',
            })
          }
        } catch {
          // Ignore HTML discovery errors
        }
      }

      return buildResult({
        ...base,
        sourceType:
          err.code === 'ACCESS_DENIED'
            ? 'AUTH_REQUIRED'
            : err.code === 'UNSUPPORTED_WEBPAGE'
              ? 'UNKNOWN_SOURCE'
              : 'INVALID_URL',
        statusLabel:
          err.code === 'ACCESS_DENIED'
            ? 'Authentication Required'
            : err.code === 'UNSUPPORTED_WEBPAGE'
              ? 'Unsupported Webpage'
              : 'Invalid Source',
        importSupported: false,
        importability: 'UNSUPPORTED',
        requiresAuthentication: err.code === 'ACCESS_DENIED',
        suggestedAction: 'EXTERNAL_LINK_OR_UPLOAD',
        capabilities: EXTERNAL_LINK_CAPABILITIES,
        rejectionReason: err.message,
        code: err.code || 'INSPECT_FAILED',
        retryable: false,
        alternatives: DEFAULT_ALTERNATIVES,
        valid: false,
        supportedForDownload: false,
        message: err.message,
      })
    }
  },
}

const PROVIDERS = [
  UnsupportedSourceProvider,
  OfficialPlatformIntegrationProvider,
  ApplePodcastsProvider,
  GoogleDriveProvider,
  DropboxProvider,
  OneDriveProvider,
  PodcastRSSProvider,
  DirectVideoProvider,
  GenericPublicMediaProvider,
].sort((a, b) => a.priority - b.priority)

export function classifyUrlWithRegistry(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return buildResult({
      sourceType: 'INVALID_URL',
      statusLabel: 'Invalid Source',
      originalUrl: rawUrl,
      rejectionReason: 'Please enter a valid http or https URL.',
      code: 'INVALID_URL',
      message: 'Please enter a valid http or https URL.',
    })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return buildResult({
      sourceType: 'INVALID_URL',
      statusLabel: 'Invalid Source',
      originalUrl: rawUrl,
      rejectionReason: 'Only http and https URLs are permitted.',
      code: 'INVALID_PROTOCOL',
      message: 'Only http and https URLs are permitted.',
    })
  }

  const provider = PROVIDERS.find((p) => p.matches(parsed)) || GenericPublicMediaProvider
  return { parsed, provider, classification: provider.classify(rawUrl, parsed) }
}

export async function resolveAndInspectSource(rawUrl, ctx = {}) {
  const res = classifyUrlWithRegistry(rawUrl)
  if (!res.provider) return res
  if (!res.classification.valid) return res.classification

  const assertSafe = ctx.assertSafePublicUrl || assertSafePublicUrl
  await assertSafe(rawUrl)

  return res.provider.inspect(rawUrl, res.parsed, ctx)
}
