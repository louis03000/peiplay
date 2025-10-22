import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 性能監控 API
export async function GET(request: NextRequest) {
  try {
    const startTime = performance.now()
    
    // 測試資料庫連接性能
    const dbStart = performance.now()
    await prisma.$connect()
    const userCount = await prisma.user.count()
    await prisma.$disconnect()
    const dbTime = performance.now() - dbStart
    
    const totalTime = performance.now() - startTime
    
    // 獲取系統信息
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    }
    
    // 性能指標
    const metrics = {
      totalResponseTime: totalTime,
      databaseQueryTime: dbTime,
      userCount,
      timestamp: new Date().toISOString(),
      systemInfo
    }
    
    // 性能評級
    let performanceGrade = 'A'
    if (totalTime > 1000) performanceGrade = 'D'
    else if (totalTime > 500) performanceGrade = 'C'
    else if (totalTime > 200) performanceGrade = 'B'
    
    return NextResponse.json({
      success: true,
      metrics,
      performanceGrade,
      recommendations: getPerformanceRecommendations(totalTime, dbTime)
    })
    
  } catch (error) {
    console.error('性能監控錯誤:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// 性能建議
function getPerformanceRecommendations(totalTime: number, dbTime: number) {
  const recommendations = []
  
  if (totalTime > 1000) {
    recommendations.push('🚨 響應時間過長，建議檢查伺服器性能')
  }
  
  if (dbTime > 500) {
    recommendations.push('🐌 資料庫查詢過慢，建議優化查詢或添加索引')
  }
  
  if (totalTime > 200) {
    recommendations.push('⚡ 建議啟用快取機制')
    recommendations.push('📦 建議壓縮靜態資源')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ 性能表現良好')
  }
  
  return recommendations
}

// 性能優化建議 API
export async function POST(request: NextRequest) {
  try {
    const { page, metrics } = await request.json()
    
    // 分析性能數據
    const analysis = analyzePerformance(metrics)
    
    // 生成優化建議
    const suggestions = generateOptimizationSuggestions(page, analysis)
    
    return NextResponse.json({
      success: true,
      analysis,
      suggestions,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('性能分析錯誤:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function analyzePerformance(metrics: any) {
  const analysis = {
    issues: [],
    strengths: [],
    score: 100
  }
  
  // 分析響應時間
  if (metrics.responseTime > 1000) {
    analysis.issues.push('響應時間過長')
    analysis.score -= 30
  } else if (metrics.responseTime < 200) {
    analysis.strengths.push('響應時間優秀')
  }
  
  // 分析資源大小
  if (metrics.resourceSize > 1000000) { // 1MB
    analysis.issues.push('資源文件過大')
    analysis.score -= 20
  }
  
  // 分析請求數量
  if (metrics.requestCount > 50) {
    analysis.issues.push('HTTP 請求過多')
    analysis.score -= 15
  }
  
  return analysis
}

function generateOptimizationSuggestions(page: string, analysis: any) {
  const suggestions = []
  
  if (analysis.issues.includes('響應時間過長')) {
    suggestions.push({
      type: 'server',
      priority: 'high',
      title: '優化伺服器響應',
      description: '啟用快取、優化資料庫查詢、使用 CDN'
    })
  }
  
  if (analysis.issues.includes('資源文件過大')) {
    suggestions.push({
      type: 'assets',
      priority: 'medium',
      title: '壓縮靜態資源',
      description: '壓縮圖片、合併 CSS/JS、啟用 Gzip'
    })
  }
  
  if (analysis.issues.includes('HTTP 請求過多')) {
    suggestions.push({
      type: 'network',
      priority: 'medium',
      title: '減少 HTTP 請求',
      description: '合併文件、使用雪碧圖、延遲載入'
    })
  }
  
  return suggestions
}
