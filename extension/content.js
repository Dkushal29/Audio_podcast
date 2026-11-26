(() => {
  const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/

  function extractYouTubeVideoId(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null
    let parsed
    try {
      parsed = new URL(rawUrl)
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

  function cleanYouTubeTitle() {
    const metaTitle =
      document
        .querySelector('h1.ytd-watch-metadata yt-formatted-string')
        ?.textContent?.trim() ||
      document.querySelector('#title h1')?.textContent?.trim() ||
      ''
    if (metaTitle) return metaTitle
    return (document.title || 'YouTube Video')
      .replace(/\s*-\s*YouTube$/i, '')
      .trim()
  }

  if (!window.__echospaceYtListenerAttached) {
    window.__echospaceYtListenerAttached = true
    const notifyNav = () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'ECHOSPACE_MEDIA_CHANGED',
            url: window.location.href,
          })
        }
      } catch {
        // Ignore extension context invalidation
      }
    }
    window.addEventListener('yt-navigate-finish', notifyNav)
    window.addEventListener('popstate', notifyNav)
  }

  const pageUrl = window.location.href
  const videoId = extractYouTubeVideoId(pageUrl)
  const isYouTube = Boolean(videoId)
  const canonicalUrl = isYouTube
    ? `https://www.youtube.com/watch?v=${videoId}`
    : pageUrl
  const thumbnailUrl = isYouTube
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : null
  const pageTitle = isYouTube
    ? cleanYouTubeTitle()
    : document.title || 'External Media'
  const channelName = isYouTube
    ? document
        .querySelector('ytd-channel-name a, #owner #channel-name a')
        ?.textContent?.trim() || null
    : null

  const mediaElements = Array.from(document.querySelectorAll('video, audio'))
  const ytPlayer = isYouTube
    ? document.querySelector('video.html5-main-video')
    : null
  const target =
    ytPlayer ||
    mediaElements.find((el) => !el.paused && !el.ended) ||
    mediaElements[0]

  if (!target) {
    if (isYouTube) {
      return {
        supported: true,
        provider: 'YOUTUBE',
        videoId,
        canonicalUrl,
        thumbnailUrl,
        tagName: 'VIDEO',
        paused: true,
        currentTime: 0,
        duration: 0,
        hasFiniteDuration: false,
        mediaSrc: canonicalUrl,
        pageTitle,
        channelName,
        pageUrl,
      }
    }
    return {
      supported: false,
      provider: 'WEB',
      reason: 'No HTML5 <audio> or <video> element found on this page.',
      pageTitle,
      pageUrl,
    }
  }

  if (target.mediaKeys && !isYouTube) {
    return {
      supported: false,
      provider: 'WEB',
      reason: 'Protected DRM media playback is not supported for annotation.',
      pageTitle,
      pageUrl,
    }
  }

  const currentTime = Number.isFinite(target.currentTime)
    ? target.currentTime
    : 0
  const duration = Number.isFinite(target.duration) ? target.duration : 0

  return {
    supported: true,
    provider: isYouTube ? 'YOUTUBE' : 'WEB',
    videoId,
    canonicalUrl,
    thumbnailUrl,
    tagName: target.tagName,
    paused: target.paused,
    currentTime,
    duration,
    hasFiniteDuration: Number.isFinite(target.duration) && target.duration > 0,
    mediaSrc: isYouTube ? canonicalUrl : target.currentSrc || pageUrl,
    pageTitle,
    channelName,
    pageUrl,
  }
})()
