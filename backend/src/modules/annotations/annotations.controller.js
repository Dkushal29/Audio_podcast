import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { AppError, asyncHandler } from '../../utils/errors.js'
import {
  ALL_ROLES,
  assertEpisodeMember,
  MANAGE_ROLES,
  WRITE_ROLES,
} from '../../middleware/workspaceAuth.js'
import {
  emitEpisodeEvent,
  emitUserEvent,
  emitWorkspaceEvent,
} from '../../sockets/index.js'

const MODE_CATEGORIES = {
  STUDY: ['QUESTION', 'NOTE'],
  CREATOR: ['FEEDBACK', 'CORRECTION', 'SUGGESTION'],
}

export const createAnnotationSchema = z.object({
  timestamp: z.number().min(0),
  category: z.enum([
    'QUESTION',
    'NOTE',
    'INSIGHT',
    'REVISION',
    'FEEDBACK',
    'CORRECTION',
    'SUGGESTION',
  ]),
  content: z.string().min(1).max(4000),
  shareToWorkspace: z.boolean().optional().default(false),
})

export const updateAnnotationSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED']).optional(),
  content: z.string().min(1).max(4000).optional(),
  timestamp: z.number().min(0).optional(),
})

export const listAnnotations = asyncHandler(async (req, res) => {
  const { episode } = await assertEpisodeMember(
    req.params.id,
    req.user.id,
    ALL_ROLES
  )

  const annotations = await prisma.annotation.findMany({
    where: { episodeId: episode.id },
    include: {
      user: { select: { id: true, name: true, avatarColor: true } },
      replies: {
        include: {
          user: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { timestamp: 'asc' },
  })

  res.json({ annotations })
})

export const createAnnotation = asyncHandler(async (req, res) => {
  const { episode } = await assertEpisodeMember(
    req.params.id,
    req.user.id,
    WRITE_ROLES
  )

  const normalizedCategory =
    episode.workspace.mode === 'STUDY' &&
    (req.body.category === 'INSIGHT' || req.body.category === 'REVISION')
      ? 'NOTE'
      : req.body.category

  const allowedCategories = MODE_CATEGORIES[episode.workspace.mode] || []
  if (!allowedCategories.includes(normalizedCategory)) {
    throw new AppError(
      400,
      `Category ${req.body.category} is not allowed in ${episode.workspace.mode} mode.`,
      'INVALID_CATEGORY'
    )
  }

  if (episode.duration > 0 && req.body.timestamp > episode.duration) {
    throw new AppError(
      400,
      `Timestamp (${req.body.timestamp}s) exceeds episode duration (${episode.duration}s).`,
      'INVALID_TIMESTAMP'
    )
  }

  const annotation = await prisma.annotation.create({
    data: {
      episodeId: episode.id,
      userId: req.user.id,
      timestamp: req.body.timestamp,
      category: normalizedCategory,
      content: req.body.content.trim(),
    },
    include: {
      user: { select: { id: true, name: true, avatarColor: true } },
      replies: true,
    },
  })

  emitEpisodeEvent(episode.id, 'annotation:created', { annotation })
  emitWorkspaceEvent(episode.workspaceId, 'workspace:annotation_created', {
    episodeId: episode.id,
    annotation,
  })

  // Notify workspace teammates on shared moments, questions, or @mentions
  const textLower = annotation.content.toLowerCase()
  const isBroadcast =
    Boolean(req.body.shareToWorkspace) ||
    textLower.includes('@team') ||
    textLower.includes('@everyone')
  const isQuestion = normalizedCategory === 'QUESTION'
  const hasAtMention = /@[a-z0-9._-]+/i.test(annotation.content)

  if (isBroadcast || isQuestion || hasAtMention) {
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: episode.workspaceId,
        userId: { not: req.user.id },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    const recipients = members.filter((m) => {
      if (isBroadcast || isQuestion) return true
      const nameToken = `@${(m.user?.name || '').toLowerCase().replace(/\s+/g, '')}`
      const firstToken = `@${(m.user?.name || '').toLowerCase().split(/\s+/)[0]}`
      const emailPrefix = `@${(m.user?.email || '').toLowerCase().split('@')[0]}`
      return (
        (nameToken.length > 1 && textLower.includes(nameToken)) ||
        (firstToken.length > 1 && textLower.includes(firstToken)) ||
        (emailPrefix.length > 1 && textLower.includes(emailPrefix))
      )
    })

    const notifType = isBroadcast
      ? 'VIDEO_MOMENT_SHARED'
      : isQuestion
        ? 'QUESTION_ASKED'
        : 'MENTIONED'
    const notifMessage = isBroadcast
      ? `${req.user.name} shared a moment in "${episode.title}".`
      : isQuestion
        ? `${req.user.name} asked a question in "${episode.title}".`
        : `${req.user.name} mentioned you in "${episode.title}".`

    for (const member of recipients.slice(0, 20)) {
      try {
        const notification = await prisma.notification.create({
          data: {
            recipientId: member.userId,
            actorId: req.user.id,
            type: notifType,
            workspaceId: episode.workspaceId,
            episodeId: episode.id,
            annotationId: annotation.id,
            message: notifMessage,
          },
          include: {
            actor: { select: { id: true, name: true, avatarColor: true } },
          },
        })
        emitUserEvent(member.userId, 'notification:created', { notification })
      } catch {
        // Never fail annotation creation if a notification write fails
      }
    }
  }

  res.status(201).json({ annotation })
})

export const updateAnnotation = asyncHandler(async (req, res) => {
  const existing = await prisma.annotation.findUnique({
    where: { id: req.params.id },
  })
  if (!existing) {
    throw new AppError(404, 'Annotation not found.', 'NOT_FOUND')
  }

  const { episode } = await assertEpisodeMember(
    existing.episodeId,
    req.user.id,
    WRITE_ROLES
  )

  if (
    req.body.timestamp !== undefined &&
    episode.duration > 0 &&
    req.body.timestamp > episode.duration
  ) {
    throw new AppError(
      400,
      `Timestamp exceeds episode duration (${episode.duration}s).`,
      'INVALID_TIMESTAMP'
    )
  }

  const annotation = await prisma.annotation.update({
    where: { id: existing.id },
    data: {
      ...(req.body.status ? { status: req.body.status } : {}),
      ...(req.body.content ? { content: req.body.content.trim() } : {}),
      ...(req.body.timestamp !== undefined
        ? { timestamp: req.body.timestamp }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, avatarColor: true } },
      replies: {
        include: {
          user: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  emitEpisodeEvent(existing.episodeId, 'annotation:updated', { annotation })

  res.json({ annotation })
})

export const deleteAnnotation = asyncHandler(async (req, res) => {
  const existing = await prisma.annotation.findUnique({
    where: { id: req.params.id },
  })
  if (!existing) {
    throw new AppError(404, 'Annotation not found.', 'NOT_FOUND')
  }

  const { membership } = await assertEpisodeMember(
    existing.episodeId,
    req.user.id,
    ALL_ROLES
  )

  const canDelete =
    MANAGE_ROLES.includes(membership.role) || existing.userId === req.user.id
  if (!canDelete) {
    throw new AppError(
      403,
      'You can only delete your own annotations.',
      'FORBIDDEN'
    )
  }

  await prisma.annotation.delete({ where: { id: existing.id } })

  emitEpisodeEvent(existing.episodeId, 'annotation:deleted', {
    annotationId: existing.id,
    episodeId: existing.episodeId,
  })

  res.status(204).end()
})
