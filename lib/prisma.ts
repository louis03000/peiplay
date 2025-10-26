import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 檢查環境變數
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 環境變數未設定')
  throw new Error('DATABASE_URL 環境變數未設定')
}

// 創建 Prisma 客戶端，針對 Vercel 優化
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn', 'info'] : ['error'],
    errorFormat: 'pretty',
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} 