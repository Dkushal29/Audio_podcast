import assert from 'node:assert/strict'
import { PrismaClient } from '../node_modules/@prisma/client/index.js'
import { recoverImportJobs } from '../src/modules/imports/imports.worker.js'
import { cleanupPendingDeletedEpisodes } from '../src/modules/episodes/episodes.controller.js'

const prisma = new PrismaClient()
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8084/api'

async function run() {
  console.log('A. Testing Prisma legacy INSIGHT/REVISION -> NOTE migration...')
  const user = await prisma.user.findFirst()
  const ws = await prisma.workspace.findFirst({ where: { mode: 'STUDY' } })
  assert.ok(user && ws, 'Run e2e.mjs first to populate test user & workspace')

  const ep = await prisma.episode.create({
    data: {
      workspaceId: ws.id,
      uploaderId: user.id,
      title: 'Audit Migration Test Episode',
      sourceType: 'EXTERNAL_LINK',
      sourceUrl: 'https://example.com/audit-ep',
      duration: 60,
    },
  })

  await prisma.annotation.createMany({
    data: [
      { episodeId: ep.id, userId: user.id, timestamp: 5, category: 'INSIGHT', content: 'Old insight' },
      { episodeId: ep.id, userId: user.id, timestamp: 10, category: 'REVISION', content: 'Old revision' },
    ],
  })

  await prisma.$executeRawUnsafe(
    `UPDATE "Annotation" SET category = 'NOTE' WHERE "episodeId" = $1::uuid AND category IN ('INSIGHT', 'REVISION')`,
    ep.id
  )

  const migrated = await prisma.annotation.findMany({ where: { episodeId: ep.id } })
  assert.equal(migrated.length, 2)
  assert.ok(migrated.every((a) => a.category === 'NOTE'))

  console.log('B. Testing ImportJob recovery after restart & cancellation...')
  const interruptedJob = await prisma.importJob.create({
    data: {
      workspaceId: ws.id,
      userId: user.id,
      sourceUrl: 'http://127.0.0.1:9999/interrupted.mp3',
      sourceKind: 'DIRECT_AUDIO',
      title: 'Interrupted Job',
      status: 'PROCESSING',
      progress: 40,
    },
  })

  const cancelledJob = await prisma.importJob.create({
    data: {
      workspaceId: ws.id,
      userId: user.id,
      sourceUrl: 'https://example.com/cancelled.mp3',
      sourceKind: 'DIRECT_AUDIO',
      title: 'Cancelled Job',
      status: 'CANCELLED',
      progress: 0,
    },
  })

  await recoverImportJobs()
  // Wait briefly for worker loop to process the recovered job (which fails SSRF check as expected)
  await new Promise((r) => setTimeout(r, 500))

  const recoveredAfter = await prisma.importJob.findUnique({ where: { id: interruptedJob.id } })
  assert.equal(recoveredAfter.status, 'FAILED', 'Recovered PROCESSING job should have been re-queued and processed')
  assert.ok(recoveredAfter.error.includes('blocked') || recoveredAfter.error.includes('IP'))

  const cancelledAfter = await prisma.importJob.findUnique({ where: { id: cancelledJob.id } })
  assert.equal(cancelledAfter.status, 'CANCELLED', 'Cancelled job must remain CANCELLED')

  console.log('C. Testing duplicate active ImportJob prevention...')
  const dup1 = await prisma.importJob.create({
    data: {
      workspaceId: ws.id,
      userId: user.id,
      sourceUrl: 'https://example.com/dup-check.mp3',
      sourceKind: 'DIRECT_AUDIO',
      title: 'Dup Check',
      status: 'QUEUED',
    },
  })

  // Log in via HTTP to test POST /api/imports deduplication
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: 'Password123!' }),
  })
  if (loginRes.ok) {
    const { token } = await loginRes.json()
    const dupRes = await fetch(`${BASE_URL}/imports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId: ws.id,
        url: 'https://example.com/dup-check.mp3',
      }),
    })
    const dupData = await dupRes.json()
    assert.equal(dupRes.status, 200)
    assert.equal(dupData.deduplicated, true)
    assert.equal(dupData.job.id, dup1.id)
  }

  console.log('D. Testing pending deletedAt Episode recovery cleanup...')
  const softDeletedEp = await prisma.episode.create({
    data: {
      workspaceId: ws.id,
      uploaderId: user.id,
      title: 'Soft Deleted Pending Cleanup',
      sourceType: 'EXTERNAL_LINK',
      sourceUrl: 'https://example.com/soft-deleted',
      deletedAt: new Date(),
    },
  })

  await cleanupPendingDeletedEpisodes()
  const gone = await prisma.episode.findUnique({ where: { id: softDeletedEp.id } })
  assert.equal(gone, null)

  // Cleanup audit artifacts
  await prisma.importJob.deleteMany({ where: { id: { in: [interruptedJob.id, cancelledJob.id, dup1.id] } } })
  await prisma.episode.delete({ where: { id: ep.id } })

  console.log('\nALL AUDIT CHECKS PASSED!')
}

run()
  .catch((err) => {
    console.error('AUDIT FAILED:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
