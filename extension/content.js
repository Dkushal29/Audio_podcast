(() => {
  const elements = Array.from(document.querySelectorAll('video, audio'))

  if (elements.length === 0) {
    return {
      supported: false,
      reason: 'No HTML5 <audio> or <video> element found on this page.',
      pageTitle: document.title || 'Untitled Page',
      pageUrl: window.location.href,
    }
  }

  // Prefer currently playing element, else first element with metadata
  const target =
    elements.find((el) => !el.paused && !el.ended) ||
    elements.find((el) => el.readyState > 0) ||
    elements[0]

  const hasDrm = Boolean(target.mediaKeys)
  if (hasDrm) {
    return {
      supported: false,
      reason:
        'Protected DRM media detected. EchoSpace does not circumvent DRM.',
      pageTitle: document.title || 'Untitled Page',
      pageUrl: window.location.href,
    }
  }

  const currentTime = Number.isFinite(target.currentTime)
    ? Math.floor(target.currentTime)
    : 0
  const duration = Number.isFinite(target.duration)
    ? Math.floor(target.duration)
    : 0

  return {
    supported: true,
    tagName: target.tagName.toLowerCase(),
    paused: Boolean(target.paused),
    currentTime,
    duration,
    hasFiniteDuration: Number.isFinite(target.duration) && target.duration > 0,
    mediaSrc: target.currentSrc || target.src || '',
    pageTitle: document.title || 'Untitled Page',
    pageUrl: window.location.href,
  }
})()
