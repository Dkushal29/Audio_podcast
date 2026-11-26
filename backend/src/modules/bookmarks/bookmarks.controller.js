import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { AppError, asyncHandler } from '../../utils/errors.js'
import {
  ALL_ROLES,
  assertEpisodeMember,
  MANAGE_ROLES,
  WRITE_ROLES,
} from '../../middleware/workspaceAuth.js'
import { emitEpisodeEvent, emitWorkspaceEvent } from '../../sockets/index.js'

export const createBookmarkSchema = z.object({
  timestamp: z.coerce.number().min(0),
  label: z.string().max(200).optional().default(''),
})

export const listBookmarks = asyncHandler(async (req, res) => {
  const { episode } = await assertEpisodeMember(
    req.params.id,
    req.user.id,
    ALL_ROLES
  )

  const bookmarks = await prisma.bookmark.findMany({
    where: { episodeId: episode.id },
    include: {
      user: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: { timestamp: 'asc' },
  })

  res.json({ bookmarks })
})

export const createBookmark = asyncHandler(async (req, res) => {
  const { episode } = await assertEpisodeMember(
    req.params.id,
    req.user.id,
    WRITE_ROLES
  )

  if (episode.duration > 0 && req.body.timestamp > episode.duration) {
    throw new AppError(
      400,
      `Timestamp (${req.body.timestamp}s) exceeds episode duration (${episode.duration}s).`,
      'INVALID_TIMESTAMP'
    )
  }

  const bookmark = await prisma.bookmark.create({
    data: {
      episodeId: episode.id,
      userId: req.user.id,
      timestamp: req.body.timestamp,
      label: (req.body.label || '').trim(),
    },
    include: {
      user: { select: { id: true, name: true, avatarColor: true } },
    },
  })

  emitEpisodeEvent(episode.id, 'bookmark:created', { bookmark })
  emitWorkspaceEvent(episode.workspaceId, 'workspace:bookmark_created', {
    episodeId: episode.id,
    bookmark,
  })

  res.status(201).json({ bookmark })
})

export const deleteBookmark = asyncHandler(async (req, res) => {
  const existing = await prisma.bookmark.findUnique({
    where: { id: req.params.id },
  })
  if (!existing) {
    throw new AppError(404, 'Bookmark not found.', 'NOT_FOUND')
  }

  const { membership, episode } = await assertEpisodeMember(
    existing.episodeId,
    req.user.id,
    WRITE_ROLES
  )

  if (
    existing.userId !== req.user.id &&
    !MANAGE_ROLES.includes(membership.role)
  ) {
    throw new AppError(
      403,
      'You can only delete your own bookmarks.',
      'FORBIDDEN'
    )
  }

  await prisma.bookmark.delete({ where: { id: existing.id } })
  emitEpisodeEvent(existing.episodeId, 'bookmark:deleted', {
    id: existing.id,
    episodeId: existing.episodeId,
    workspaceId: episode.workspaceId,
  })

  res.json({ deleted: true, id: existing.id })
})
