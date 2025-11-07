import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'

/**
 * 資料庫健康檢查 API
 * GET /api/health/database
 */
export async function GET() {
  try {
    const health = await db.healthCheck()
    const circuitBreaker = db.getCircuitBreakerStatus()

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 503

    return NextResponse.json(
      {
        status: health.status,
        database: {
          responseTime: health.responseTime,
          responsive: health.status !== 'unhealthy',
        },
        circuitBreaker: {
          state: circuitBreaker.state,
          failureCount: circuitBreaker.failureCount,
          lastFailureTime: circuitBreaker.lastFailureTime,
        },
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    )
  } catch (error) {
    console.error('❌ Health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Failed to perform health check',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}

