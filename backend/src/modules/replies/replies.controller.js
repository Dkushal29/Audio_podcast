import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { AppError, asyncHandler } from '../../utils/errors.js'
import {
  ALL_ROLES,
  assertEpisodeMember,
  WRITE_ROLES,
} from '../../middleware/workspaceAuth.js'
import { emitEpisodeEvent } from '../../sockets/index.js'

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

  res.status(201).json({ reply })
})
