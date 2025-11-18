import { PrismaClient, Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * 資料庫彈性處理工具
 * 提供：重試機制、斷路器、連接健康檢查
 */

// ========== 配置 ==========
const RETRY_CONFIG = {
  maxAttempts: 3,           // 最大重試次數
  initialDelay: 1000,       // 初始延遲（毫秒）- 增加以給資料庫更多恢復時間
  maxDelay: 10000,          // 最大延遲（毫秒）- 增加最大等待時間
  backoffMultiplier: 2,     // 延遲倍增係數
}

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,      // 失敗閾值（連續失敗幾次後打開斷路器）
  successThreshold: 2,      // 成功閾值（成功幾次後關閉斷路器）
  timeout: 60000,           // 超時時間（毫秒）- 增加到60秒
  resetTimeout: 90000,      // 重置時間（毫秒，斷路器打開後多久嘗試恢復）- 增加到90秒
}

// ========== 斷路器狀態 ==========
enum CircuitState {
  CLOSED = 'CLOSED',       // 正常狀態
  OPEN = 'OPEN',           // 斷路器打開（拒絕請求）
  HALF_OPEN = 'HALF_OPEN', // 半開狀態（嘗試恢復）
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private nextAttemptTime = 0
  private lastFailureTime: Date | null = null

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // 檢查斷路器狀態
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN - database is temporarily unavailable')
      }
      // 嘗試恢復（進入半開狀態）
      this.state = CircuitState.HALF_OPEN
      this.successCount = 0
      console.log('🔄 Circuit breaker entering HALF_OPEN state')
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failureCount = 0

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= CIRCUIT_BREAKER_CONFIG.successThreshold) {
        this.state = CircuitState.CLOSED
        console.log('✅ Circuit breaker closed - database connection restored')
      }
    }
  }

  private onFailure() {
    this.failureCount++
    this.lastFailureTime = new Date()

    if (this.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      this.state = CircuitState.OPEN
      this.nextAttemptTime = Date.now() + CIRCUIT_BREAKER_CONFIG.resetTimeout
      console.error(`🚨 Circuit breaker opened - too many failures (${this.failureCount})`)
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    }
  }

  reset() {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.nextAttemptTime = 0
    console.log('🔄 Circuit breaker reset')
  }
}

// ========== 全局斷路器實例 ==========
const circuitBreaker = new CircuitBreaker()

// ========== 重試邏輯 ==========
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function calculateBackoff(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1)
  const jitter = Math.random() * 0.3 * exponentialDelay // 加入隨機抖動，避免雷鳴羣
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelay)
}

function isRetriableError(error: any): boolean {
  const retriableErrors = [
    'ECONNREFUSED',      // 連接被拒絕
    'ETIMEDOUT',         // 連接超時
    'ENOTFOUND',         // DNS 查詢失敗
    'ECONNRESET',        // 連接被重置
    'EPIPE',             // 管道損壞
    'P2024',             // Prisma: Timed out fetching a new connection
    'P2034',             // Prisma: Transaction failed due to a write conflict
    'P1001',             // Prisma: Can't reach database server
    'P1002',             // Prisma: Database server timeout
    'P1008',             // Prisma: Operations timed out
    'P1017',             // Prisma: Connection pool timeout
  ]

  const errorMessage = error?.message?.toLowerCase() || ''
  const errorCode = error?.code || ''

  return (
    retriableErrors.some(code => errorCode.includes(code)) ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('pool') ||
    errorMessage.includes('temporarily unavailable')
  )
}

/**
 * 帶有重試機制的資料庫操作執行器
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'Database operation'
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      // 通過斷路器執行操作
      const result = await circuitBreaker.execute(operation)
      
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`)
      }
      
      return result
    } catch (error: any) {
      lastError = error
      
      const isLastAttempt = attempt === RETRY_CONFIG.maxAttempts
      const shouldRetry = isRetriableError(error)

      console.error(`❌ ${operationName} failed (attempt ${attempt}/${RETRY_CONFIG.maxAttempts}):`, {
        message: error.message,
        code: error.code,
        shouldRetry,
      })

      // 如果是最後一次嘗試或錯誤不可重試，直接拋出
      if (isLastAttempt || !shouldRetry) {
        throw error
      }

      // 計算延遲時間並等待
      const delayMs = calculateBackoff(attempt)
      console.log(`⏳ Retrying ${operationName} in ${delayMs}ms...`)
      await delay(delayMs)
    }
  }

  throw lastError
}

/**
 * 資料庫操作包裝器（推薦使用）
 */
export const db = {
  /**
   * 執行查詢操作（自動重試）
   */
  async query<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    operationName?: string
  ): Promise<T> {
    return executeWithRetry(
      () => operation(prisma),
      operationName || 'Query'
    )
  },

  /**
   * 執行事務操作（自動重試）
   */
  async transaction<T>(
    operations: ((prisma: Prisma.TransactionClient) => Promise<T>)[],
    operationName?: string
  ): Promise<T[]> {
    return executeWithRetry(
      async () => {
        return prisma.$transaction(async (tx) => {
          const results: T[] = []

          for (const operation of operations) {
            results.push(await operation(tx))
          }

          return results
        })
      },
      operationName || 'Transaction'
    )
  },

  /**
   * 健康檢查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    responseTime: number
    circuitBreaker: any
  }> {
    const startTime = Date.now()
    
    try {
      await executeWithRetry(
        async () => {
          await prisma.$queryRaw`SELECT 1`
        },
        'Health check'
      )
      
      const responseTime = Date.now() - startTime
      const status = responseTime < 1000 ? 'healthy' : 'degraded'
      
      return {
        status,
        responseTime,
        circuitBreaker: circuitBreaker.getStatus(),
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        circuitBreaker: circuitBreaker.getStatus(),
      }
    }
  },

  /**
   * 獲取斷路器狀態
   */
  getCircuitBreakerStatus() {
    return circuitBreaker.getStatus()
  },

  /**
   * 重置斷路器
   */
  resetCircuitBreaker() {
    circuitBreaker.reset()
  },
}

/**
 * 連接預熱（在應用啟動時調用）
 */
export async function warmupConnection(): Promise<void> {
  try {
    console.log('🔥 Warming up database connection...')
    await prisma.$connect()
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database connection warmed up')
  } catch (error) {
    console.error('❌ Failed to warm up database connection:', error)
    // 不拋出錯誤，讓應用繼續啟動
  }
}

// ========== 連接池監控 ==========
export function startConnectionMonitoring(intervalMs: number = 60000) {
  if (process.env.NODE_ENV === 'production') {
    setInterval(async () => {
      try {
        const health = await db.healthCheck()
        console.log('📊 Database health:', health)
        
        if (health.status === 'unhealthy') {
          console.error('🚨 Database is unhealthy!')
        }
      } catch (error) {
        console.error('❌ Health check failed:', error)
      }
    }, intervalMs)
  }
}

