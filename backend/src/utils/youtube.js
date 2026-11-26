const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/

export function extractYouTubeVideoId(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  let parsed
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  let candidate = null

  if (host === 'youtu.be') {
    candidate = parsed.pathname.split('/').filter(Boolean)[0] || null
  } else if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    if (parsed.pathname === '/watch') {
      candidate = parsed.searchParams.get('v')
    } else {
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (
        parts.length >= 2 &&
        ['embed', 'shorts', 'live', 'v'].includes(parts[0])
      ) {
        candidate = parts[1]
      }
    }
  }

  return candidate && YOUTUBE_ID_REGEX.test(candidate) ? candidate : null
}

export function canonicalizeExternalMediaUrl(rawUrl) {
  const videoId = extractYouTubeVideoId(rawUrl)
  if (videoId) {
    return {
      provider: 'YOUTUBE',
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    }
  }
  return {
    provider: 'WEB',
    videoId: null,
    url: String(rawUrl || '').trim(),
    thumbnailUrl: null,
  }
}
