import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { checkDatabaseHealth } from '@/lib/db-connection'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log("🔧 開始資料庫診斷和修復...")
    
    const results = {
      environment: {} as {
        hasDatabaseUrl: boolean;
        nodeEnv: string | undefined;
        vercelEnv: string | undefined;
        databaseUrlPrefix: string;
      },
      connection: {} as {
        success: boolean;
        error: string | undefined;
        type: string | undefined;
        healthCheck?: any;
      },
      schema: {} as {
        success: boolean;
        tableCounts?: any;
        error?: string;
      },
      fixes: [] as Array<{
        type: string;
        success: boolean;
        message: string;
        userId?: string;
        error?: string;
      }>
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
    let connectionError: Error | null = null
    try {
      await db.query(async (client) => {
        await client.$queryRaw`SELECT 1 as test`
      })
      connectionTest = true
      console.log("✅ 基本連接測試成功")
    } catch (error) {
      connectionError = error instanceof Error ? error : new Error(String(error))
      console.error("❌ 基本連接測試失敗:", error)
    }
    
    results.connection = {
      success: connectionTest,
      error: connectionError?.message,
      type: connectionError?.constructor?.name
    }
    
    // 3. 如果連接成功，測試 schema
    if (connectionTest) {
      try {
        const { tableTests, testDataResult } = await db.query(async (client) => {
          // 測試各個表的查詢
          const [users, partners, customers, schedules, bookings] = await Promise.all([
            client.user.count(),
            client.partner.count(),
            client.customer.count(),
            client.schedule.count(),
            client.booking.count()
          ]);

          const tableTests = {
            users,
            partners,
            customers,
            schedules,
            bookings
          };

          // 4. 嘗試創建測試數據
          let testDataResult: any = null;
          try {
            const testUser = await client.user.create({
              data: {
                email: `test-${Date.now()}@example.com`,
                password: 'test-password',
                name: 'Test User'
              }
            });

            // 清理測試數據
            await client.user.delete({
              where: { id: testUser.id }
            });

            testDataResult = {
              created: true,
              cleaned: true,
              userId: testUser.id
            };
          } catch (testError) {
            testDataResult = {
              created: false,
              cleaned: false,
              error: testError instanceof Error ? testError.message : String(testError)
            };
          }

          return { tableTests, testDataResult };
        });

        results.schema = {
          success: true,
          tableCounts: tableTests
        };

        console.log("✅ Schema 測試成功:", tableTests);

        if (testDataResult.created) {
          results.fixes.push({
            type: 'test_data_created',
            success: true,
            message: '測試用戶創建成功',
            userId: testDataResult.userId
          });

          results.fixes.push({
            type: 'test_data_cleaned',
            success: true,
            message: '測試數據清理成功'
          });
        } else {
          results.fixes.push({
            type: 'test_data_creation',
            success: false,
            message: '測試數據創建失敗',
            error: testDataResult.error
          });
        }

      } catch (schemaError) {
        results.schema = {
          success: false,
          error: schemaError instanceof Error ? schemaError.message : String(schemaError)
        };
        console.error("❌ Schema 測試失敗:", schemaError);
      }
    }
    
    // 5. 健康檢查
    const healthCheck = await checkDatabaseHealth()
    results.connection = {
      ...results.connection,
      healthCheck
    }
    
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
