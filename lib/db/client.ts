/**
 * 統一的資料庫客戶端管理
 * 
 * 設計原則：
 * 1. 單例模式，確保所有 API 使用同一個 client
 * 2. 嚴禁任何地方呼叫 $disconnect()
 * 3. 適用於 Vercel Serverless 環境
 * 4. 完全隔離，不影響其他模組
 */

import { PrismaClient, Prisma } from '@prisma/client'

// ========== 類型定義 ==========
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ========== 環境檢查 ==========
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 環境變數未設定')
  throw new Error('DATABASE_URL 環境變數未設定')
}

// ========== 資料庫 URL 配置 ==========
function getDatabaseUrlWithPool(): string {
  const dbUrl = process.env.DATABASE_URL || ''
  
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    try {
      const url = new URL(dbUrl)
      const isSupabase = url.hostname.includes('supabase.co')
      const isVercel = process.env.VERCEL === '1'
      
      // 只在沒有這些參數時才添加
      if (!url.searchParams.has('connection_limit') && !url.searchParams.has('pool_timeout')) {
        if (isVercel) {
          url.searchParams.set('connection_limit', isSupabase ? '2' : '3')
          url.searchParams.set('pool_timeout', '60')
          url.searchParams.set('connect_timeout', '30')
          url.searchParams.set('statement_timeout', '45000')
        } else {
          const maxConnections = isSupabase ? '5' : '10'
          url.searchParams.set('connection_limit', maxConnections)
          url.searchParams.set('pool_timeout', '30')
          url.searchParams.set('connect_timeout', '15')
          url.searchParams.set('statement_timeout', '30000')
          url.searchParams.set('application_name', 'peiplay')
        }
      }
      
      return url.toString()
    } catch (error) {
      console.error('❌ DATABASE_URL 格式錯誤:', error)
      return dbUrl
    }
  }
  
  return dbUrl
}

// ========== 創建 Prisma Client（單例模式）==========
/**
 * 獲取 Prisma Client 實例
 * 
 * 在 development 環境：使用 globalThis 保證單例
 * 在 production（Vercel）：也使用 globalThis，避免重複建立
 * 
 * ⚠️ 嚴禁在任何地方呼叫 $disconnect()
 * ⚠️ 嚴禁直接 new PrismaClient()
 */
export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    errorFormat: 'pretty',
    datasources: {
      db: {
        url: getDatabaseUrlWithPool(),
      },
    },
  })

  // 在 serverless 環境中，使用 globalThis 重用實例
  globalForPrisma.prisma = client

  return client
}

// ========== 導出單例實例 ==========
/**
 * 統一的 Prisma Client 實例
 * 
 * 所有 API route 必須使用此實例，不可直接 new PrismaClient()
 */
export const prisma = getPrismaClient()

// ========== 連接管理 ==========
let connectionPromise: Promise<void> | null = null

/**
 * 確保資料庫連接已建立
 * 僅在首次使用時建立連接
 */
export async function ensureConnection(): Promise<void> {
  if (!connectionPromise) {
    connectionPromise = prisma.$connect().catch((error: any) => {
      if (error?.message?.includes('already connected')) {
        return
      }
      connectionPromise = null
      throw error
    })
  }
  return connectionPromise
}

// ========== 優雅關閉（僅在應用關閉時）==========
/**
 * ⚠️ 警告：此函數僅應在應用關閉時呼叫
 * 嚴禁在 API route 或 service 中呼叫
 */
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
  
  process.on('SIGINT', async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  
  process.on('SIGTERM', async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

// ========== 類型導出 ==========
export type { Prisma, PrismaClient }

