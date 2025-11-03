import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 檢查環境變數
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 環境變數未設定')
  throw new Error('DATABASE_URL 環境變數未設定')
}

// 解析 DATABASE_URL 並添加連接池參數（如果是 PostgreSQL）
function getDatabaseUrlWithPool(): string {
  const dbUrl = process.env.DATABASE_URL || ''
  
  // 如果是 PostgreSQL 且沒有連接池參數，添加連接池配置
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    const url = new URL(dbUrl)
    
    // 只在沒有這些參數時才添加
    if (!url.searchParams.has('connection_limit') && !url.searchParams.has('pool_timeout')) {
      url.searchParams.set('connection_limit', '10') // 最大連接數
      url.searchParams.set('pool_timeout', '10') // 連接池超時（秒）
      url.searchParams.set('connect_timeout', '10') // 連接超時（秒）
    }
    
    return url.toString()
  }
  
  return dbUrl
}

// 創建 Prisma 客戶端，針對 Vercel serverless 環境優化
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn', 'info'] : ['error'],
    errorFormat: 'pretty',
    datasources: {
      db: {
        url: getDatabaseUrlWithPool(),
      },
    },
  })

// 在 serverless 環境中，每次都使用同一個實例（如果可用）
// 這樣可以重用連接池，提高性能
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} else {
  // 生產環境也使用單例模式，避免在 serverless 中創建過多連接
  globalForPrisma.prisma = prisma
}

// 優雅關閉處理
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
} 