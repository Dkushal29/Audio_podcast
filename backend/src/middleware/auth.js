import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { AppError } from '../utils/errors.js'

export async function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const queryToken = req.query?.token
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : typeof queryToken === 'string'
        ? queryToken
        : null

    if (!token) {
      throw new AppError(401, 'Authentication required.', 'UNAUTHORIZED')
    }

    const payload = jwt.verify(token, env.jwtSecret)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarColor: true,
        createdAt: true,
      },
    })

    if (!user) {
      throw new AppError(401, 'Invalid authentication token.', 'UNAUTHORIZED')
    }

    req.user = user
    next()
  } catch (err) {
    if (err instanceof AppError) return next(err)
    return next(new AppError(401, 'Invalid or expired token.', 'UNAUTHORIZED'))
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    if (!authHeader.startsWith('Bearer ')) return next()
    const token = authHeader.slice(7)
    const payload = jwt.verify(token, env.jwtSecret)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, avatarColor: true },
    })
    if (user) req.user = user
  } catch {
    // Ignore invalid optional token
  }
  next()
}
