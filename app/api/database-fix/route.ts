import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkDatabaseHealth } from '@/lib/db-connection'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log("🔧 開始資料庫診斷和修復...")
    
    const results = {
      environment: {},
      connection: {},
      schema: {},
      fixes: []
    }
    
    // 1. 檢查環境變數
    results.environment = {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...' || 'Not set'
    }
    
    // 2. 測試基本連接
    let connectionTest = false
    let connectionError = null
    try {
      await prisma.$connect()
      await prisma.$queryRaw`SELECT 1 as test`
      connectionTest = true
      console.log("✅ 基本連接測試成功")
    } catch (error) {
      connectionError = error
      console.error("❌ 基本連接測試失敗:", error)
    } finally {
      try {
        await prisma.$disconnect()
      } catch (e) {
        console.error("❌ 斷開連接失敗:", e)
      }
    }
    
    results.connection = {
      success: connectionTest,
      error: connectionError?.message,
      type: connectionError?.constructor?.name
    }
    
    // 3. 如果連接成功，測試 schema
    if (connectionTest) {
      try {
        await prisma.$connect()
        
        // 測試各個表的查詢
        const tableTests = {
          users: await prisma.user.count(),
          partners: await prisma.partner.count(),
          customers: await prisma.customer.count(),
          schedules: await prisma.schedule.count(),
          bookings: await prisma.booking.count()
        }
        
        results.schema = {
          success: true,
          tableCounts: tableTests
        }
        
        console.log("✅ Schema 測試成功:", tableTests)
        
        // 4. 嘗試創建測試數據
        try {
          const testUser = await prisma.user.create({
            data: {
              email: `test-${Date.now()}@example.com`,
              password: 'test-password',
              name: 'Test User'
            }
          })
          
          results.fixes.push({
            type: 'test_data_created',
            success: true,
            message: '測試用戶創建成功',
            userId: testUser.id
          })
          
          // 清理測試數據
          await prisma.user.delete({
            where: { id: testUser.id }
          })
          
          results.fixes.push({
            type: 'test_data_cleaned',
            success: true,
            message: '測試數據清理成功'
          })
          
        } catch (testError) {
          results.fixes.push({
            type: 'test_data_creation',
            success: false,
            message: '測試數據創建失敗',
            error: testError.message
          })
        }
        
        await prisma.$disconnect()
        
      } catch (schemaError) {
        results.schema = {
          success: false,
          error: schemaError.message
        }
        console.error("❌ Schema 測試失敗:", schemaError)
      }
    }
    
    // 5. 健康檢查
    const healthCheck = await checkDatabaseHealth()
    results.connection.healthCheck = healthCheck
    
    // 6. 提供修復建議
    const suggestions = []
    
    if (!results.environment.hasDatabaseUrl) {
      suggestions.push({
        type: 'environment',
        priority: 'high',
        message: 'DATABASE_URL 環境變數未設定',
        fix: '在 Vercel 設定中添加 DATABASE_URL'
      })
    }
    
    if (!connectionTest) {
      suggestions.push({
        type: 'connection',
        priority: 'high',
        message: '資料庫連接失敗',
        fix: '檢查資料庫服務狀態和連接字串'
      })
    }
    
    if (connectionTest && !results.schema.success) {
      suggestions.push({
        type: 'schema',
        priority: 'medium',
        message: 'Schema 查詢失敗',
        fix: '執行 prisma db push 或 prisma migrate deploy'
      })
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      suggestions,
      summary: {
        environmentOk: results.environment.hasDatabaseUrl,
        connectionOk: connectionTest,
        schemaOk: results.schema.success,
        overallStatus: connectionTest && results.schema.success ? 'healthy' : 'needs_attention'
      }
    })
    
  } catch (error) {
    console.error("❌ 資料庫診斷失敗:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
