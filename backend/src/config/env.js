import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '../..')

dotenv.config({ path: path.join(backendRoot, '.env') })

const maxMb = Number(process.env.MAX_FILE_SIZE_MB || 100)
const rawOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const configuredUploadDir = process.env.UPLOAD_DIR || 'uploads'

export const env = {
  port: Number(process.env.PORT || 8080),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: rawOrigins,
  allowExtensionCors: process.env.ALLOW_EXTENSION_CORS !== 'false',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  storageDriver: process.env.STORAGE_DRIVER || 'local',
  allowEphemeralStorage: process.env.ALLOW_EPHEMERAL_STORAGE === 'true',
  uploadDir: path.isAbsolute(configuredUploadDir)
    ? configuredUploadDir
    : path.resolve(backendRoot, configuredUploadDir),
  maxFileSizeBytes: maxMb * 1024 * 1024,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:8080',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  deepgramModel: process.env.DEEPGRAM_MODEL || 'nova-2',
  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'auto',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    signedUrlExpiresIn: Number(process.env.S3_SIGNED_URL_EXPIRES_IN || 3600),
    timeoutMs: Number(process.env.S3_TIMEOUT_MS || 30000),
  },
}

if (!env.jwtSecret) {
  if (env.nodeEnv === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production.')
  }
  env.jwtSecret = 'dev-only-echospace-secret-change-in-prod'
}

if (env.nodeEnv === 'production' && env.storageDriver !== 's3' && !env.allowEphemeralStorage) {
  throw new Error(
    'Production requires STORAGE_DRIVER=s3 (persistent object storage). Set ALLOW_EPHEMERAL_STORAGE=true only if using a mounted persistent disk.'
  )
}
