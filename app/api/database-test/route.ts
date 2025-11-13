import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { checkDatabaseHealth } from '@/lib/db-connection'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log("🔍 測試資料庫連接...")
    
    // 1. 檢查環境變數
    const hasDatabaseUrl = !!process.env.DATABASE_URL
    console.log("📊 DATABASE_URL 存在:", hasDatabaseUrl)
    
    // 2. 檢查 Prisma 連接和查詢
    let prismaTest = false
    let prismaError: Error | null = null
    let queryTest = false
    let queryError: Error | null = null
    
    try {
      await db.query(async (client) => {
        await client.$queryRaw`SELECT 1`
        prismaTest = true
        console.log("✅ Prisma 連接成功")
        
        const result = await client.user.count()
        queryTest = true
        console.log("✅ 查詢測試成功，用戶數量:", result)
      })
    } catch (error) {
      prismaError = error instanceof Error ? error : new Error(String(error))
      queryError = error instanceof Error ? error : new Error(String(error))
      console.error("❌ Prisma 連接或查詢失敗:", error)
    }
    
    // 3. 檢查連接管理器
    const healthCheck = await checkDatabaseHealth()
    console.log("📊 連接管理器狀態:", healthCheck)
    
    return NextResponse.json({
      success: true,
      database: {
        hasDatabaseUrl,
        prismaConnected: prismaTest,
        prismaError: prismaError?.message,
        queryTest,
        queryError: queryError?.message,
        healthCheck
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL
      }
    })
    
  } catch (error) {
    console.error("❌ 資料庫測試失敗:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      database: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        prismaConnected: false,
        queryTest: false
      }
    }, { status: 500 })
  }
}
