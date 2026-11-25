import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { createRateLimiter } from '../../middleware/rateLimit.js'
import {
  login,
  loginSchema,
  me,
  register,
  registerSchema,
} from './auth.controller.js'

const router = Router()
const authLimiter = createRateLimiter({ windowMs: 60_000, max: 30 })

router.post('/register', authLimiter, validate(registerSchema), register)
router.post('/login', authLimiter, validate(loginSchema), login)
router.get('/me', requireAuth, me)

export default router
