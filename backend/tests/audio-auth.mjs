import assert from 'node:assert/strict'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8081/api'

async function api(method, endpoint, { token, body, isForm } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json() : await res.text()
  return { status: res.status, headers: res.headers, data }
}

function createFakeMp3Blob() {
  const header = Buffer.from([
    0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0xff, 0xfb, 0x90, 0x64,
  ])
  return new Blob([Buffer.concat([header, Buffer.alloc(4096, 0x00)])], {
    type: 'audio/mpeg',
  })
}

async function run() {
  const suffix = Date.now()
  const u1 = `audio.owner.${suffix}@echospace.test`
  const u2 = `audio.outsider.${suffix}@echospace.test`

  const r1 = await api('POST', '/auth/register', { body: { name: 'Owner', email: u1, password: 'Password123!' } })
  assert.equal(r1.status, 201, `r1 failed: ${JSON.stringify(r1.data)}`)
  const r2 = await api('POST', '/auth/register', { body: { name: 'Outsider', email: u2, password: 'Password123!' } })
  assert.equal(r2.status, 201, `r2 failed: ${JSON.stringify(r2.data)}`)

  const l1 = await api('POST', '/auth/login', { body: { email: u1, password: 'Password123!' } })
  assert.equal(l1.status, 200, `l1 failed: ${JSON.stringify(l1.data)}`)
  const l2 = await api('POST', '/auth/login', { body: { email: u2, password: 'Password123!' } })
  assert.equal(l2.status, 200, `l2 failed: ${JSON.stringify(l2.data)}`)
  const token1 = l1.data.token
  const token2 = l2.data.token

  const wsRes = await api('POST', '/workspaces', {
    token: token1,
    body: { name: 'Audio Auth Workspace', mode: 'STUDY' },
  })
  assert.equal(wsRes.status, 201, `Workspace create failed: ${JSON.stringify(wsRes.data)}`)
  const wsId = wsRes.data.workspace.id

  const form = new FormData()
  form.append('audio', createFakeMp3Blob(), 'auth-test.mp3')
  form.append('workspaceId', wsId)
  form.append('title', 'Auth Test Lecture')
  form.append('duration', '10')
  const upRes = await api('POST', '/episodes/upload', { token: token1, body: form, isForm: true })
  assert.equal(upRes.status, 201)
  const epId = upRes.data.episode.id

  console.log('1. Verifying unauthenticated & invalid JWT return 401...')
  const unauth = await fetch(`${BASE_URL}/episodes/${epId}/audio`)
  assert.equal(unauth.status, 401)
  const badJwt = await fetch(`${BASE_URL}/episodes/${epId}/audio?token=invalid.jwt.token`)
  assert.equal(badJwt.status, 401)

  console.log('2. Verifying outsider from another workspace gets 403...')
  const outsider = await api('GET', `/episodes/${epId}/audio-url`, { token: token2 })
  assert.equal(outsider.status, 403)

  console.log('3. Minting short-lived scoped playback URL...')
  const access = await api('GET', `/episodes/${epId}/audio-url`, { token: token1 })
  assert.equal(access.status, 200)
  assert.ok(access.data.url.includes('/audio?token='))
  assert.equal(access.data.expiresIn, 900)

  const scopedToken = new URL(access.data.url).searchParams.get('token')
  assert.ok(scopedToken)

  console.log('4. Verifying scoped playback token streams 200 and 206 Range...')
  const fullRes = await fetch(access.data.url)
  assert.equal(fullRes.status, 200)
  assert.equal(fullRes.headers.get('accept-ranges'), 'bytes')

  const rangeRes = await fetch(access.data.url, { headers: { Range: 'bytes=0-1023' } })
  assert.equal(rangeRes.status, 206)
  assert.equal(rangeRes.headers.get('content-range'), 'bytes 0-1023/4110')
  assert.equal(rangeRes.headers.get('content-length'), '1024')

  console.log('5. Verifying scoped playback token is rejected on metadata routes...')
  const metaAttempt = await api('GET', `/episodes/${epId}`, { token: scopedToken })
  assert.equal(metaAttempt.status, 401)

  console.log('6. Verifying WaveSurfer Authorization header streaming works...')
  const bearerRange = await fetch(`${BASE_URL}/episodes/${epId}/audio`, {
    headers: { Authorization: `Bearer ${token1}`, Range: 'bytes=1024-2047' },
  })
  assert.equal(bearerRange.status, 206)

  console.log('7. Cleaning up test episode from Tigris + Neon...')
  const del = await api('DELETE', `/episodes/${epId}`, { token: token1 })
  assert.equal(del.status, 204)

  console.log('ALL AUTHENTICATED AUDIO DELIVERY TESTS PASSED!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
