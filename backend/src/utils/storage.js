import fs from 'fs'
import path from 'path'
import { env } from '../config/env.js'

function ensureUploadDir() {
  if (!fs.existsSync(env.uploadDir)) {
    fs.mkdirSync(env.uploadDir, { recursive: true })
  }
}

function resolveKeyPath(key) {
  const safeKey = path.basename(key)
  return path.join(env.uploadDir, safeKey)
}

/**
 * Storage abstraction compatible with future MinIO/S3 driver.
 */
export const storage = {
  async saveLocalFile(tempPath, targetKey) {
    ensureUploadDir()
    const destPath = resolveKeyPath(targetKey)
    try {
      await fs.promises.rename(tempPath, destPath)
    } catch (err) {
      if (err.code === 'EXDEV') {
        await fs.promises.copyFile(tempPath, destPath)
        await fs.promises.unlink(tempPath).catch(() => {})
      } else {
        throw err
      }
    }
    return { key: path.basename(targetKey), path: destPath }
  },

  async stat(key) {
    const filePath = resolveKeyPath(key)
    return fs.promises.stat(filePath)
  },

  createReadStream(key, options = {}) {
    const filePath = resolveKeyPath(key)
    return fs.createReadStream(filePath, options)
  },

  async remove(key) {
    const filePath = resolveKeyPath(key)
    try {
      await fs.promises.unlink(filePath)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  },
}
