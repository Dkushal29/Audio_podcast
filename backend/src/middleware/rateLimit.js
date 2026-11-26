const buckets = new Map()

export function createRateLimiter({ windowMs = 60_000, max = 120 } = {}) {
  return (req, res, next) => {
    const key = `${req.user?.id || req.ip || 'anon'}:${req.baseUrl || ''}`
    const now = Date.now()
    let entry = buckets.get(key)
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      buckets.set(key, entry)
    }
    entry.count += 1
    if (entry.count > max) {
      res.setHeader(
        'Retry-After',
        Math.ceil((entry.resetAt - now) / 1000).toString()
      )
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down and try again.',
        },
      })
    }
    next()
  }
}
