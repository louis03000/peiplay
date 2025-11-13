import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseStats } from '@/lib/db-connection'

export const dynamic = 'force-dynamic'

// 資料庫問題診斷 API
export async function GET(request: NextRequest) {
  try {
    const diagnosis = await performDatabaseDiagnosis()
    
    return NextResponse.json({
      success: true,
      diagnosis,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ 資料庫診斷失敗:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function performDatabaseDiagnosis() {
  const issues = []
  const solutions = []
  const warnings = []
  
  // 1. 檢查環境變數
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    issues.push({
      type: 'critical',
      message: 'DATABASE_URL 環境變數未設定',
      impact: '完全無法連接資料庫'
    })
    solutions.push({
      priority: 'high',
      action: '在 Vercel Dashboard 中設定 DATABASE_URL 環境變數',
      details: '前往 Vercel 專案設定 > Environment Variables 添加 DATABASE_URL'
    })
  } else {
    // 檢查 URL 格式
    try {
      const url = new URL(databaseUrl)
      if (!url.hostname || !url.port) {
        issues.push({
          type: 'critical',
          message: 'DATABASE_URL 格式不正確',
          impact: '無法解析資料庫連接資訊'
        })
        solutions.push({
          priority: 'high',
          action: '檢查 DATABASE_URL 格式',
          details: 'URL 應包含主機名和端口號'
        })
      }
    } catch (error) {
      issues.push({
        type: 'critical',
        message: 'DATABASE_URL 格式錯誤',
        impact: '無法解析資料庫連接資訊'
      })
      solutions.push({
        priority: 'high',
        action: '修正 DATABASE_URL 格式',
        details: '確保 URL 格式正確'
      })
    }
  }
  
  // 2. 檢查連接統計
  const connectionStats = getDatabaseStats()
  
  if (connectionStats.connectionCount > 8) {
    warnings.push({
      type: 'warning',
      message: `連接數較高: ${connectionStats.connectionCount}`,
      impact: '可能導致連接池耗盡'
    })
    solutions.push({
      priority: 'medium',
      action: '優化連接池配置',
      details: '減少同時連接數或增加連接池大小'
    })
  }
  
  if (connectionStats.retryCount > 3) {
    issues.push({
      type: 'warning',
      message: `連接重試次數過多: ${connectionStats.retryCount}`,
      impact: '資料庫連接不穩定'
    })
    solutions.push({
      priority: 'medium',
      action: '檢查資料庫服務狀態',
      details: '檢查 Supabase 服務是否正常，網路連接是否穩定'
    })
  }
  
  // 3. 檢查 Supabase 特定問題
  if (databaseUrl && databaseUrl.includes('supabase')) {
    // 檢查是否為免費層級
    if (databaseUrl.includes('pooler.supabase.com')) {
      warnings.push({
        type: 'info',
        message: '使用 Supabase 連接池',
        impact: '免費層級有連接數限制'
      })
      solutions.push({
        priority: 'low',
        action: '考慮升級 Supabase 方案',
        details: '免費層級限制 60 個連接，升級後可獲得更多連接'
      })
    }
    
    // 檢查地區設定
    if (databaseUrl.includes('ap-southeast')) {
      warnings.push({
        type: 'info',
        message: '資料庫位於亞太地區',
        impact: '台灣用戶連接可能較慢'
      })
    }
  }
  
  // 4. 檢查 Next.js 環境
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv === 'production') {
    // 生產環境特定檢查
    if (!process.env.NEXTAUTH_SECRET) {
      warnings.push({
        type: 'warning',
        message: 'NEXTAUTH_SECRET 未設定',
        impact: '可能影響認證功能'
      })
    }
  }
  
  // 5. 生成診斷報告
  const diagnosis = {
    overall: issues.length === 0 ? 'healthy' : issues.some(i => i.type === 'critical') ? 'critical' : 'warning',
    issues,
    warnings,
    solutions,
    connectionStats,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!databaseUrl,
      isSupabase: databaseUrl?.includes('supabase') || false,
      isProduction: nodeEnv === 'production'
    }
  }
  
  return diagnosis
}

// 自動修復建議
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    const fixes = []
    
    switch (action) {
      case 'check_env':
        fixes.push(await checkEnvironmentVariables())
        break
      case 'test_connection':
        fixes.push(await testDatabaseConnection())
        break
      case 'optimize_config':
        fixes.push(await optimizeDatabaseConfig())
        break
      default:
        fixes.push(await performFullDiagnosis())
    }
    
    return NextResponse.json({
      success: true,
      fixes,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ 自動修復失敗:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function checkEnvironmentVariables() {
  const issues = []
  const fixes = []
  
  if (!process.env.DATABASE_URL) {
    issues.push('DATABASE_URL 未設定')
    fixes.push('在 Vercel Dashboard 中設定 DATABASE_URL')
  }
  
  if (!process.env.NEXTAUTH_SECRET) {
    issues.push('NEXTAUTH_SECRET 未設定')
    fixes.push('在 Vercel Dashboard 中設定 NEXTAUTH_SECRET')
  }
  
  return {
    action: 'check_env',
    issues,
    fixes,
    status: issues.length === 0 ? 'success' : 'needs_attention'
  }
}

async function testDatabaseConnection() {
  try {
    const { db } = await import('@/lib/db-resilience')
    const startTime = performance.now()
    
    await db.query(async (client) => {
      await client.$queryRaw`SELECT 1`
    })
    
    const connectionTime = performance.now() - startTime
    
    return {
      action: 'test_connection',
      status: 'success',
      connectionTime,
      message: `連接成功 (${connectionTime.toFixed(2)}ms)`
    }
  } catch (error) {
    return {
      action: 'test_connection',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '連接失敗'
    }
  }
}

async function optimizeDatabaseConfig() {
  const optimizations = []
  
  // 檢查連接池配置
  const connectionStats = getDatabaseStats()
  
  if (connectionStats.connectionCount > 5) {
    optimizations.push({
      type: 'connection_pool',
      message: '建議優化連接池配置',
      details: '減少同時連接數或增加連接池大小'
    })
  }
  
  // 檢查重試配置
  if (connectionStats.retryCount > 2) {
    optimizations.push({
      type: 'retry_config',
      message: '建議調整重試配置',
      details: '增加重試間隔或減少重試次數'
    })
  }
  
  return {
    action: 'optimize_config',
    optimizations,
    status: optimizations.length === 0 ? 'optimal' : 'needs_optimization'
  }
}

async function performFullDiagnosis() {
  const diagnosis = await performDatabaseDiagnosis()
  
  return {
    action: 'full_diagnosis',
    diagnosis,
    status: diagnosis.overall
  }
}
