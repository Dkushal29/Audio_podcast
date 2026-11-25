import http from 'http'
import { env } from './config/env.js'
import { createApp } from './app.js'
import { initSocketServer } from './sockets/index.js'

const app = createApp()
const server = http.createServer(app)

initSocketServer(server)

server.listen(env.port, () => {
  console.log(`EchoSpace backend listening on http://localhost:${env.port}`)
})
