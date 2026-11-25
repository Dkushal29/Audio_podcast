import dotenv from 'dotenv'
import path from 'path'

dotenv.config()

const maxMb = Number(process.env.MAX_FILE_SIZE_MB || 100)

export const env = {
  port: Number(process.env.PORT || 8080),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-echospace-secret-change-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  storageDriver: process.env.STORAGE_DRIVER || 'local',
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
  maxFileSizeBytes: maxMb * 1024 * 1024,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:8080',
}
