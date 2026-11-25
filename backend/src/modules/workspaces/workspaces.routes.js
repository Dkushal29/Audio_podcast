import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import {
  addMember,
  addMemberSchema,
  create,
  createWorkspaceSchema,
  getOne,
  list,
  update,
  updateWorkspaceSchema,
} from './workspaces.controller.js'

const router = Router()

router.use(requireAuth)

router.post('/', validate(createWorkspaceSchema), create)
router.get('/', list)
router.get('/:id', getOne)
router.patch('/:id', validate(updateWorkspaceSchema), update)
router.post('/:id/members', validate(addMemberSchema), addMember)

export default router
