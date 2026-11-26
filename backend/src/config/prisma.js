import { PrismaClient } from '@prisma/client'

const basePrisma = new PrismaClient()

function isTransientConnectionError(err) {
  const code = err?.code || err?.errorCode
  if (code === 'P1017' || code === 'P1001' || code === 'P1008') return true
  const msg = String(err?.message || '')
  return (
    msg.includes("Can't reach database server") ||
    msg.includes('Server has closed the connection') ||
    msg.includes('Connection terminated unexpectedly')
  )
}

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await query(args)
          } catch (err) {
            if (attempt < 2 && isTransientConnectionError(err)) {
              await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
              await basePrisma.$connect().catch(() => {})
              continue
            }
            throw err
          }
        }
      },
    },
  },
})
