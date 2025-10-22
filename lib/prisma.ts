import { PrismaClient } from '@prisma/client'
import { getDatabaseConnection } from './db-connection'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 使用新的連接管理系統
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 導出新的連接管理函數
export { getDatabaseConnection, checkDatabaseHealth, getDatabaseStats } from './db-connection' 