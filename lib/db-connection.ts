import { PrismaClient } from '@prisma/client'

// 創建一個新的 Prisma 實例，專門用於 API 路由
export function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

// 用於 API 路由的資料庫操作包裝器
export async function withDatabase<T>(
  operation: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const prisma = createPrismaClient()
  
  try {
    // 確保連接
    await prisma.$connect()
    const result = await operation(prisma)
    return result
  } catch (error) {
    console.error('資料庫操作錯誤:', error)
    throw error
  } finally {
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('關閉資料庫連接時發生錯誤:', disconnectError)
    }
  }
}
