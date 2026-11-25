import { Router } from 'express'
import { prisma } from '../../config/prisma.js'
import { requireAuth } from '../../middleware/auth.js'
import { AppError, asyncHandler } from '../../utils/errors.js'

const router = Router()

router.use(requireAuth)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: req.user.id },
      include: {
        actor: { select: { id: true, name: true, avatarColor: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Attach annotation timestamp & episode title for direct navigation
    const annIds = [...new Set(notifications.map((n) => n.annotationId))]
    const epIds = [...new Set(notifications.map((n) => n.episodeId))]

    const [anns, eps] = await Promise.all([
      prisma.annotation.findMany({
        where: { id: { in: annIds } },
        select: { id: true, timestamp: true },
      }),
      prisma.episode.findMany({
        where: { id: { in: epIds } },
        select: { id: true, title: true },
      }),
    ])

    const annMap = Object.fromEntries(anns.map((a) => [a.id, a.timestamp]))
    const epMap = Object.fromEntries(eps.map((e) => [e.id, e.title]))

    const enriched = notifications.map((n) => ({
      ...n,
      timestamp: annMap[n.annotationId] ?? 0,
      episodeTitle: epMap[n.episodeId] || 'Recording',
    }))

    const unreadCount = enriched.filter((n) => !n.isRead).length
    res.json({ notifications: enriched, unreadCount })
  })
)

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const existing = await prisma.notification.findUnique({
      where: { id: req.params.id },
    })
    if (!existing) {
      throw new AppError(404, 'Notification not found.', 'NOT_FOUND')
    }
    if (existing.recipientId !== req.user.id) {
      throw new AppError(403, 'Forbidden.', 'FORBIDDEN')
    }

    const notification = await prisma.notification.update({
      where: { id: existing.id },
      data: { isRead: true },
    })
    res.json({ notification })
  })
)

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { recipientId: req.user.id, isRead: false },
      data: { isRead: true },
    })
    res.json({ ok: true })
  })
)

export default router
