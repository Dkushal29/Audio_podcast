import assert from 'node:assert/strict'
import { io as ioClient } from 'socket.io-client'
import {
  canonicalizeExternalMediaUrl,
  extractYouTubeVideoId,
} from '../src/utils/youtube.js'

const BASE_URL = process.env.ECHOSPACE_TEST_URL || 'http://127.0.0.1:8081'
const API_URL = `${BASE_URL}/api`

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function run() {
  console.log('1. Testing YouTube URL extraction & canonicalization...')
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=45s'),
    'dQw4w9WgXcQ'
  )
  assert.equal(
    extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=abc'),
    'dQw4w9WgXcQ'
  )
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/shorts/abcdefghijk'),
    'abcdefghijk'
  )
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/live/12345678901?feature=share'),
    '12345678901'
  )
  assert.equal(extractYouTubeVideoId('https://vimeo.com/123456789'), null)

  const canon = canonicalizeExternalMediaUrl('https://youtu.be/dQw4w9WgXcQ?t=12')
  assert.equal(canon.provider, 'YOUTUBE')
  assert.equal(canon.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  assert.equal(
    canon.thumbnailUrl,
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
  )

  console.log('2. Registering test users & creating workspace...')
  const suffix = Date.now()
  const ownerEmail = `yt-owner-${suffix}@example.com`
  const mateEmail = `yt-mate-${suffix}@example.com`
  const outsiderEmail = `yt-out-${suffix}@example.com`

  const r1 = await api('/auth/register', {
    method: 'POST',
    body: { name: 'YT Owner', email: ownerEmail, password: 'Password123!' },
  })
  assert.equal(r1.status, 201)
  const ownerToken = r1.data.token

  const r2 = await api('/auth/register', {
    method: 'POST',
    body: { name: 'YT Teammate', email: mateEmail, password: 'Password123!' },
  })
  assert.equal(r2.status, 201)
  const mateToken = r2.data.token

  const r3 = await api('/auth/register', {
    method: 'POST',
    body: { name: 'YT Outsider', email: outsiderEmail, password: 'Password123!' },
  })
  assert.equal(r3.status, 201)
  const outsiderToken = r3.data.token

  const wsRes = await api('/workspaces', {
    method: 'POST',
    token: ownerToken,
    body: { name: `YT Study ${suffix}`, mode: 'STUDY' },
  })
  assert.equal(wsRes.status, 201)
  const workspaceId = wsRes.data.workspace.id

  const addMemberRes = await api(`/workspaces/${workspaceId}/members`, {
    method: 'POST',
    token: ownerToken,
    body: { email: mateEmail, role: 'MEMBER' },
  })
  assert.equal(addMemberRes.status, 201)

  console.log('3. Connecting Socket.IO workspace room...')
  const socket = ioClient(BASE_URL, {
    auth: { token: mateToken },
    transports: ['websocket'],
  })
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve)
    socket.on('connect_error', reject)
  })

  const joinAck = await new Promise((resolve) => {
    socket.emit('workspace:join', { workspaceId }, resolve)
  })
  assert.equal(joinAck.ok, true)

  const events = []
  socket.on('workspace:episode_created', (p) =>
    events.push({ type: 'workspace:episode_created', p })
  )
  socket.on('workspace:annotation_created', (p) =>
    events.push({ type: 'workspace:annotation_created', p })
  )
  socket.on('workspace:bookmark_created', (p) =>
    events.push({ type: 'workspace:bookmark_created', p })
  )

  console.log('4. Testing canonical YouTube session creation & deduplication...')
  const ep1 = await api('/episodes/external', {
    method: 'POST',
    token: ownerToken,
    body: {
      workspaceId,
      title: 'Distributed Systems Lecture 1',
      sourceUrl: 'https://youtu.be/dQw4w9WgXcQ?t=42',
      duration: 1800,
      reuseExisting: true,
    },
  })
  assert.equal(ep1.status, 201)
  assert.equal(ep1.data.reused, false)
  assert.equal(ep1.data.provider, 'YOUTUBE')
  assert.equal(
    ep1.data.episode.sourceUrl,
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  )
  const episodeId = ep1.data.episode.id

  const ep2 = await api('/episodes/external', {
    method: 'POST',
    token: mateToken,
    body: {
      workspaceId,
      title: 'Distributed Systems Lecture 1',
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123',
      duration: 1800,
      reuseExisting: true,
    },
  })
  assert.equal(ep2.status, 200)
  assert.equal(ep2.data.reused, true)
  assert.equal(ep2.data.episode.id, episodeId)

  console.log('5. Testing annotations, questions, replies, and bookmarks...')
  const annRes = await api(`/episodes/${episodeId}/annotations`, {
    method: 'POST',
    token: mateToken,
    body: {
      timestamp: 763,
      category: 'QUESTION',
      content: 'Why does Raft need a randomized election timeout here?',
    },
  })
  assert.equal(annRes.status, 201)
  const annotationId = annRes.data.annotation.id

  const shareRes = await api(`/episodes/${episodeId}/annotations`, {
    method: 'POST',
    token: ownerToken,
    body: {
      timestamp: 272,
      category: 'NOTE',
      content: '@team Check this deadlock explanation at 04:32!',
      shareToWorkspace: true,
    },
  })
  assert.equal(shareRes.status, 201)

  const mateNotifs = await api('/notifications', { token: mateToken })
  assert.equal(mateNotifs.status, 200)
  assert.ok(
    mateNotifs.data.notifications.some(
      (n) => n.type === 'VIDEO_MOMENT_SHARED' && n.episodeId === episodeId
    )
  )
  const ownerNotifs = await api('/notifications', { token: ownerToken })
  assert.equal(ownerNotifs.status, 200)
  assert.ok(
    ownerNotifs.data.notifications.some(
      (n) => n.type === 'QUESTION_ASKED' && n.episodeId === episodeId
    )
  )

  const replyRes = await api(`/annotations/${annotationId}/replies`, {
    method: 'POST',
    token: ownerToken,
    body: { content: 'To avoid split votes across nodes.' },
  })
  assert.equal(replyRes.status, 201)

  const bmRes = await api(`/episodes/${episodeId}/bookmarks`, {
    method: 'POST',
    token: ownerToken,
    body: { timestamp: 125, label: 'Leader election diagram' },
  })
  assert.equal(bmRes.status, 201)
  const bookmarkId = bmRes.data.bookmark.id

  const listBmRes = await api(`/episodes/${episodeId}/bookmarks`, {
    token: mateToken,
  })
  assert.equal(listBmRes.status, 200)
  assert.equal(listBmRes.data.bookmarks.length, 1)
  assert.equal(listBmRes.data.bookmarks[0].id, bookmarkId)

  const getEpRes = await api(`/episodes/${episodeId}`, { token: mateToken })
  assert.equal(getEpRes.status, 200)
  assert.equal(getEpRes.data.episode.bookmarks.length, 1)

  console.log('6. Testing negative / security cases...')
  const badTs = await api(`/episodes/${episodeId}/bookmarks`, {
    method: 'POST',
    token: ownerToken,
    body: { timestamp: -5, label: 'Invalid' },
  })
  assert.equal(badTs.status, 400)

  const forbiddenBm = await api(`/episodes/${episodeId}/bookmarks`, {
    method: 'POST',
    token: outsiderToken,
    body: { timestamp: 10, label: 'Intruder' },
  })
  assert.equal(forbiddenBm.status, 403)

  const delBm = await api(`/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
    token: ownerToken,
  })
  assert.equal(delBm.status, 200)

  // Allow socket events to flush
  await new Promise((r) => setTimeout(r, 150))
  socket.disconnect()

  assert.ok(events.some((e) => e.type === 'workspace:episode_created'))
  assert.ok(events.some((e) => e.type === 'workspace:annotation_created'))
  assert.ok(events.some((e) => e.type === 'workspace:bookmark_created'))

  console.log('All YouTube collaboration tests passed!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
