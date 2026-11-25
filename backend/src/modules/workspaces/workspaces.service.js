import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/errors.js'
import {
  ALL_ROLES,
  assertWorkspaceMember,
  MANAGE_ROLES,
} from '../../middleware/workspaceAuth.js'

export async function createWorkspace({ name, mode, ownerId }) {
  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      mode,
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: 'OWNER',
        },
      },
      ...(mode === 'CREATOR'
        ? {
            shows: {
              create: {
                title: `${name.trim()} Show`,
                description: `Podcast feed for ${name.trim()}`,
                rssSlug: `show-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              },
            },
          }
        : {}),
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarColor: true } },
        },
      },
      shows: true,
    },
  })

  return workspace
}

export async function listUserWorkspaces(userId) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: {
            select: { episodes: true, members: true, playlists: true },
          },
          shows: true,
        },
      },
    },
    orderBy: { workspace: { createdAt: 'desc' } },
  })

  return memberships.map((m) => ({
    ...m.workspace,
    myRole: m.role,
  }))
}

export async function getWorkspaceDetail(workspaceId, userId) {
  const membership = await assertWorkspaceMember(workspaceId, userId, ALL_ROLES)

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarColor: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
      shows: true,
      episodes: {
        include: {
          uploader: { select: { id: true, name: true, avatarColor: true } },
          chapters: { orderBy: { startTime: 'asc' } },
          annotations: {
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
          },
          clips: {
            include: {
              creator: { select: { id: true, name: true, avatarColor: true } },
              episode: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { annotations: true, clips: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      playlists: {
        include: {
          episodes: {
            orderBy: { position: 'asc' },
            include: {
              episode: {
                select: { id: true, title: true, duration: true, createdAt: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return { ...workspace, myRole: membership.role }
}

export async function updateWorkspace(workspaceId, userId, updates) {
  await assertWorkspaceMember(workspaceId, userId, MANAGE_ROLES)

  return prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(updates.name ? { name: updates.name.trim() } : {}),
    },
  })
}

export async function addWorkspaceMember(workspaceId, actorId, { email, role }) {
  await assertWorkspaceMember(workspaceId, actorId, MANAGE_ROLES)

  const targetUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true, avatarColor: true },
  })

  if (!targetUser) {
    throw new AppError(
      404,
      'No registered user found with that email.',
      'USER_NOT_FOUND'
    )
  }

  const member = await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: targetUser.id } },
    update: { role },
    create: {
      workspaceId,
      userId: targetUser.id,
      role,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarColor: true } },
    },
  })

  return member
}
