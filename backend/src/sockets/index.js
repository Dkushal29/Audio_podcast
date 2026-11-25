import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { assertEpisodeMember, ALL_ROLES } from '../middleware/workspaceAuth.js'

let ioInstance = null

export function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '')
      if (!token) {
        return next(new Error('Authentication required'))
      }
      const payload = jwt.verify(token, env.jwtSecret)
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true, avatarColor: true },
      })
      if (!user) return next(new Error('Invalid user'))
      socket.user = user
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    socket.on('episode:join', async ({ episodeId } = {}, ack) => {
      try {
        if (!episodeId) {
          ack?.({ ok: false, error: 'episodeId is required' })
          return
        }
        await assertEpisodeMember(episodeId, socket.user.id, ALL_ROLES)
        const room = `episode:${episodeId}`
        await socket.join(room)
        ack?.({ ok: true, room })
      } catch (err) {
        ack?.({ ok: false, error: err.message || 'Forbidden' })
      }
    })

    socket.on('episode:leave', ({ episodeId } = {}) => {
      if (episodeId) {
        socket.leave(`episode:${episodeId}`)
      }
    })
  })

  ioInstance = io
  return io
}

export function emitEpisodeEvent(episodeId, eventName, payload) {
  if (!ioInstance) return
  ioInstance.to(`episode:${episodeId}`).emit(eventName, payload)
}
