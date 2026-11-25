import http from 'http'
import { env } from './config/env.js'
import { prisma } from './config/prisma.js'
import { createApp } from './app.js'
import { initSocketServer } from './sockets/index.js'
import { recoverImportJobs } from './modules/imports/imports.worker.js'
import { cleanupPendingDeletedEpisodes } from './modules/episodes/episodes.controller.js'

const app = createApp()
const server = http.createServer(app)

const io = initSocketServer(server)

server.listen(env.port, '0.0.0.0', () => {
  console.log(`EchoSpace backend listening on http://0.0.0.0:${env.port}`)
  cleanupPendingDeletedEpisodes().catch((err) => {
    console.error('[Cleanup] Pending episode cleanup error:', err.message)
  })
  recoverImportJobs().catch((err) => {
    console.error('[ImportWorker] Recovery error:', err.message)
  })
})

async function shutdown(signal) {
  console.log(`\n[EchoSpace] Received ${signal}. Shutting down gracefully...`)
  io.close()
  server.close(async () => {
    await prisma.$disconnect().catch(() => {})
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
