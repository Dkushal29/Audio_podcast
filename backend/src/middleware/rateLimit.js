const buckets = new Map()

export function createRateLimiter({ windowMs = 60_000, max = 30, message } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`
    const now = Date.now()
    const entry = buckets.get(key)

    if (!entry || now > entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    entry.count += 1
    if (entry.count > max) {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: message || 'Too many requests. Please try again shortly.',
        },
      })
    }

    next()
  }
}
