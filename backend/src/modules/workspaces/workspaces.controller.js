import { z } from 'zod'
import { asyncHandler } from '../../utils/errors.js'
import {
  addWorkspaceMember,
  createWorkspace,
  getWorkspaceDetail,
  listUserWorkspaces,
  updateWorkspace,
} from './workspaces.service.js'

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  mode: z.enum(['STUDY', 'CREATOR']),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
})

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'EDITOR', 'MEMBER', 'VIEWER']).default('MEMBER'),
})

export const create = asyncHandler(async (req, res) => {
  const workspace = await createWorkspace({
    ...req.body,
    ownerId: req.user.id,
  })
  res.status(201).json({ workspace })
})

export const list = asyncHandler(async (req, res) => {
  const workspaces = await listUserWorkspaces(req.user.id)
  res.json({ workspaces })
})

export const getOne = asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceDetail(req.params.id, req.user.id)
  res.json({ workspace })
})

export const update = asyncHandler(async (req, res) => {
  const workspace = await updateWorkspace(req.params.id, req.user.id, req.body)
  res.json({ workspace })
})

export const addMember = asyncHandler(async (req, res) => {
  const member = await addWorkspaceMember(req.params.id, req.user.id, req.body)
  res.status(201).json({ member })
})
