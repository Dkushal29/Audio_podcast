import fs from 'fs'
import os from 'os'
import path from 'path'
import { Router } from 'express'
import multer from 'multer'
import { env } from '../../config/env.js'
import { requireAuth } from '../../middleware/auth.js'
import {
  deleteEpisode,
  getEpisode,
  streamEpisodeAudio,
  uploadEpisode,
} from './episodes.controller.js'

const tempUploadDir = path.join(os.tmpdir(), 'echospace-uploads')
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true })
}

const upload = multer({
  dest: tempUploadDir,
  limits: {
    fileSize: env.maxFileSizeBytes,
  },
})

const router = Router()

router.use(requireAuth)

router.post('/upload', upload.single('audio'), uploadEpisode)
router.get('/:id', getEpisode)
router.get('/:id/audio', streamEpisodeAudio)
router.delete('/:id', deleteEpisode)

export default router
