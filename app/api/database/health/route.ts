import { NextRequest, NextResponse } from 'next/server'
import { checkDatabaseHealth, getDatabaseStats } from '@/lib/db-connection'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic'

// 資料庫健康檢查 API
export async function GET(request: NextRequest) {
  const startTime = performance.now()
  
  try {
    // 基本連接檢查
    const healthStatus = await checkDatabaseHealth()
    
    // 執行簡單查詢測試
    const queryStart = performance.now()
    const { userCount, dbInfo } = await db.query(async (client) => {
      const count = await client.user.count()
      const info = await client.$queryRaw`
        SELECT 
          version() as version,
          current_database() as database_name,
          current_user as current_user,
          inet_server_addr() as server_address,
          inet_server_port() as server_port
      ` as any[]
      return { userCount: count, dbInfo: info }
    })
    const queryTime = performance.now() - queryStart
    
    const totalTime = performance.now() - startTime
    
    // 性能評級
    let performanceGrade = 'A'
    if (totalTime > 2000) performanceGrade = 'D'
    else if (totalTime > 1000) performanceGrade = 'C'
    else if (totalTime > 500) performanceGrade = 'B'
    
    // 連接統計
    const connectionStats = getDatabaseStats()
    
    return NextResponse.json({
      success: true,
      health: {
        isConnected: healthStatus.isConnected,
        connectionCount: healthStatus.connectionCount,
        lastConnectionTime: healthStatus.lastConnectionTime,
        retryCount: healthStatus.retryCount
      },
      performance: {
        totalResponseTime: totalTime,
        queryTime: queryTime,
        userCount,
        performanceGrade
      },
      database: {
        info: dbInfo[0] || {},
        connectionStats
      },
      timestamp: new Date().toISOString(),
      recommendations: getDatabaseRecommendations(totalTime, queryTime, healthStatus)
    })
    
  } catch (error) {
    console.error('❌ 資料庫健康檢查失敗:', error)
    
    const totalTime = performance.now() - startTime
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      health: {
        isConnected: false,
        connectionCount: 0,
        lastConnectionTime: null,
        retryCount: 0
      },
      performance: {
        totalResponseTime: totalTime,
        queryTime: 0,
        userCount: 0,
        performanceGrade: 'F'
      },
      timestamp: new Date().toISOString(),
      recommendations: [
        '🚨 資料庫連接失敗，請檢查 DATABASE_URL 環境變數',
        '🔧 檢查 Supabase 服務狀態',
        '📞 聯繫技術支援'
      ]
    }, { status: 500 })
  }
}

// 資料庫性能分析
export async function POST(request: NextRequest) {
  try {
    const { testType = 'basic' } = await request.json()
    
    const startTime = performance.now()
    let results: any = {}
    
    switch (testType) {
      case 'basic':
        results = await runBasicTests()
        break
      case 'stress':
        results = await runStressTests()
        break
      case 'connection':
        results = await runConnectionTests()
        break
      default:
        results = await runBasicTests()
    }
    
    const totalTime = performance.now() - startTime
    
    return NextResponse.json({
      success: true,
      testType,
      results,
      totalTime,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ 資料庫性能測試失敗:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// 基本測試
async function runBasicTests() {
  const tests = []
  
  // 測試 1: 簡單查詢
  const start1 = performance.now()
  await db.query(async (client) => {
    await client.user.count()
  })
  const time1 = performance.now() - start1
  tests.push({ name: '用戶計數查詢', time: time1, status: time1 < 100 ? 'good' : 'slow' })
  
  // 測試 2: 複雜查詢
  const start2 = performance.now()
  await db.query(async (client) => {
    await client.user.findMany({ take: 10 })
  })
  const time2 = performance.now() - start2
  tests.push({ name: '用戶列表查詢', time: time2, status: time2 < 200 ? 'good' : 'slow' })
  
  // 測試 3: 關聯查詢
  const start3 = performance.now()
  await db.query(async (client) => {
    await client.user.findMany({
      include: { 
        customer: {
          include: {
            bookings: true
          }
        }
      },
      take: 5
    })
  })
  const time3 = performance.now() - start3
  tests.push({ name: '關聯查詢', time: time3, status: time3 < 500 ? 'good' : 'slow' })
  
  return { tests, averageTime: tests.reduce((sum, test) => sum + test.time, 0) / tests.length }
}

// 壓力測試
async function runStressTests() {
  const tests = []
  const concurrentRequests = 5
  
  // 並發查詢測試
  const start = performance.now()
  const promises = Array.from({ length: concurrentRequests }, () => 
    db.query(async (client) => {
      return await client.user.count()
    })
  )
  
  await Promise.all(promises)
  const time = performance.now() - start
  
  tests.push({ 
    name: `並發查詢 (${concurrentRequests}個)`, 
    time, 
    status: time < 1000 ? 'good' : 'slow' 
  })
  
  return { tests, concurrentRequests }
}

// 連接測試
async function runConnectionTests() {
  const tests = []
  
  // 測試連接建立時間（使用 db.query 會自動處理連接）
  const start = performance.now()
  await db.query(async (client) => {
    await client.$queryRaw`SELECT 1`
  })
  const connectTime = performance.now() - start
  tests.push({ name: '連接建立', time: connectTime, status: connectTime < 1000 ? 'good' : 'slow' })
  
  // 測試連接穩定性
  const stabilityStart = performance.now()
  for (let i = 0; i < 10; i++) {
    await db.query(async (client) => {
      await client.$queryRaw`SELECT 1`
    })
  }
  const stabilityTime = performance.now() - stabilityStart
  tests.push({ name: '連接穩定性 (10次查詢)', time: stabilityTime, status: stabilityTime < 2000 ? 'good' : 'slow' })
  
  return { tests }
}

// 資料庫建議
function getDatabaseRecommendations(totalTime: number, queryTime: number, health: any) {
  const recommendations = []
  
  if (totalTime > 2000) {
    recommendations.push('🚨 總響應時間過長，建議檢查網路連接')
  }
  
  if (queryTime > 1000) {
    recommendations.push('🐌 查詢時間過慢，建議優化資料庫索引')
  }
  
  if (health.retryCount > 0) {
    recommendations.push('⚠️ 檢測到連接重試，建議檢查資料庫穩定性')
  }
  
  if (health.connectionCount > 8) {
    recommendations.push('📊 連接數較高，建議檢查連接池配置')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ 資料庫性能良好')
  }
  
  return recommendations
}
