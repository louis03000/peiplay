import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 檢查環境變數
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 環境變數未設定')
  throw new Error('DATABASE_URL 環境變數未設定')
}

// 創建 Prisma 客戶端，針對 Vercel 和性能優化
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
    // 性能優化設定
    engineType: 'library', // 使用 library 引擎以提高性能
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} 