import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import {
  createReply,
  createReplySchema,
  deleteReply,
  listReplies,
} from './replies.controller.js'

const router = Router()

router.get('/annotations/:id/replies', requireAuth, listReplies)
router.post(
  '/annotations/:id/replies',
  requireAuth,
  validate(createReplySchema),
  createReply
)
router.delete('/replies/:id', requireAuth, deleteReply)

export default router
