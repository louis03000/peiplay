import { PrismaClient } from '@prisma/client'
import { getDatabaseConnection } from './db-connection'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 檢查環境變數
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 環境變數未設定')
  throw new Error('DATABASE_URL 環境變數未設定')
}

// 創建 Prisma 客戶端，添加更好的錯誤處理
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn', 'info'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    errorFormat: 'pretty',
  })

// 添加連接測試
prisma.$connect()
  .then(() => {
    console.log('✅ Prisma 連接成功')
  })
  .catch((error) => {
    console.error('❌ Prisma 連接失敗:', error)
    // 不拋出錯誤，讓應用程式繼續運行
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 導出新的連接管理函數
export { getDatabaseConnection, checkDatabaseHealth, getDatabaseStats } from './db-connection' 