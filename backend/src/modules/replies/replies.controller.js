import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { AppError, asyncHandler } from '../../utils/errors.js'
import {
  ALL_ROLES,
  assertEpisodeMember,
  MANAGE_ROLES,
  WRITE_ROLES,
} from '../../middleware/workspaceAuth.js'
import { emitEpisodeEvent, emitUserEvent } from '../../sockets/index.js'

export const createReplySchema = z.object({
  content: z.string().min(1).max(3000),
})

export const listReplies = asyncHandler(async (req, res) => {
  const annotation = await prisma.annotation.findUnique({
    where: { id: req.params.id },
  })
  if (!annotation) {
    throw new AppError(404, 'Annotation not found.', 'NOT_FOUND')
  }

  await assertEpisodeMember(annotation.episodeId, req.user.id, ALL_ROLES)

  const replies = await prisma.annotationReply.findMany({
    where: { annotationId: annotation.id },
    include: {
      user: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  res.json({ replies, count: replies.length })
})

export const createReply = asyncHandler(async (req, res) => {
  const annotation = await prisma.annotation.findUnique({
    where: { id: req.params.id },
    include: {
      episode: { select: { id: true, title: true, workspaceId: true } },
    },
  })
  if (!annotation) {
    throw new AppError(404, 'Annotation not found.', 'NOT_FOUND')
  }

  await assertEpisodeMember(annotation.episodeId, req.user.id, WRITE_ROLES)

  const reply = await prisma.annotationReply.create({
    data: {
      annotationId: annotation.id,
      userId: req.user.id,
      content: req.body.content.trim(),
    },
    include: {
      user: { select: { id: true, name: true, avatarColor: true } },
    },
  })

  emitEpisodeEvent(annotation.episodeId, 'reply:created', {
    annotationId: annotation.id,
    reply,
  })

  if (annotation.userId !== req.user.id) {
    const recipientMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: annotation.episode.workspaceId,
          userId: annotation.userId,
        },
      },
    })

    if (recipientMember) {
      const notification = await prisma.notification.create({
        data: {
          recipientId: annotation.userId,
          actorId: req.user.id,
          type: 'QUESTION_ANSWERED',
          workspaceId: annotation.episode.workspaceId,
          episodeId: annotation.episodeId,
          annotationId: annotation.id,
          replyId: reply.id,
          message: `Your ${annotation.category.toLowerCase()} was answered by ${req.user.name}.`,
        },
        include: {
          actor: { select: { id: true, name: true, avatarColor: true } },
        },
      })

      emitUserEvent(annotation.userId, 'notification:created', {
        notification: {
          ...notification,
          timestamp: annotation.timestamp,
          episodeTitle: annotation.episode.title,
        },
      })
    }
  }

  res.status(201).json({ reply })
})

export const deleteReply = asyncHandler(async (req, res) => {
  const reply = await prisma.annotationReply.findUnique({
    where: { id: req.params.id },
    include: { annotation: true },
  })
  if (!reply) {
    throw new AppError(404, 'Reply not found.', 'NOT_FOUND')
  }

  const { membership } = await assertEpisodeMember(
    reply.annotation.episodeId,
    req.user.id,
    ALL_ROLES
  )

  const canDelete =
    MANAGE_ROLES.includes(membership.role) || reply.userId === req.user.id
  if (!canDelete) {
    throw new AppError(403, 'You can only delete your own replies.', 'FORBIDDEN')
  }

  await prisma.annotationReply.delete({ where: { id: reply.id } })

  emitEpisodeEvent(reply.annotation.episodeId, 'reply:deleted', {
    annotationId: reply.annotationId,
    replyId: reply.id,
  })

  res.status(204).end()
})
