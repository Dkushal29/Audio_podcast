import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { createRateLimiter } from '../../middleware/rateLimit.js'
import {
  cancelTranscription,
  deleteTranscription,
  getTranscription,
  getTranscriptionStatus,
  requestTranscription,
  requestTranscriptionSchema,
  retryTranscription,
  searchTranscription,
  updateSpeakerLabels,
  updateSpeakersSchema,
} from './transcriptions.controller.js'

const router = Router()
const transcribeLimiter = createRateLimiter({ windowMs: 60_000, max: 15 })

for (const prefix of ['/episodes/:episodeId', '/audio/:audioId']) {
  router.post(
    `${prefix}/transcription`,
    requireAuth,
    transcribeLimiter,
    validate(requestTranscriptionSchema),
    requestTranscription
  )
  router.get(`${prefix}/transcription`, requireAuth, getTranscription)
  router.get(`${prefix}/transcription/status`, requireAuth, getTranscriptionStatus)
  router.get(`${prefix}/transcription/search`, requireAuth, searchTranscription)
  router.post(`${prefix}/transcription/retry`, requireAuth, retryTranscription)
  router.post(`${prefix}/transcription/cancel`, requireAuth, cancelTranscription)
  router.patch(
    `${prefix}/transcription/speakers`,
    requireAuth,
    validate(updateSpeakersSchema),
    updateSpeakerLabels
  )
  router.delete(`${prefix}/transcription`, requireAuth, deleteTranscription)
}

export default router
