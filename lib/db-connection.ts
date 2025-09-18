import { PrismaClient } from '@prisma/client'

// 創建一個新的 Prisma 實例，專門用於 API 路由
export function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// 用於 API 路由的資料庫操作包裝器
export async function withDatabase<T>(
  operation: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const prisma = createPrismaClient()
  
  try {
    const result = await operation(prisma)
    return result
  } finally {
    await prisma.$disconnect()
  }
}
