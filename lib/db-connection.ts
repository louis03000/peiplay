import { PrismaClient } from '@prisma/client'

// 連接池配置
const CONNECTION_POOL_CONFIG = {
  maxConnections: 10,
  minConnections: 2,
  connectionTimeout: 30000, // 30秒
  idleTimeout: 60000, // 60秒
  retryAttempts: 3,
  retryDelay: 1000, // 1秒
}

// 連接狀態監控
class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager
  private prisma: PrismaClient | null = null
  private connectionCount = 0
  private isConnected = false
  private lastConnectionTime: Date | null = null
  private retryCount = 0

  private constructor() {}

  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager()
    }
    return DatabaseConnectionManager.instance
  }

  async getConnection(): Promise<PrismaClient> {
    try {
      // 如果已有連接且正常，直接返回
      if (this.prisma && this.isConnected) {
        return this.prisma
      }

      // 檢查連接數限制
      if (this.connectionCount >= CONNECTION_POOL_CONFIG.maxConnections) {
        throw new Error('連接池已滿，請稍後再試')
      }

      // 創建新連接
      await this.createConnection()
      return this.prisma!
      
    } catch (error) {
      console.error('❌ 資料庫連接失敗:', error)
      await this.handleConnectionError(error)
      throw error
    }
  }

  private async createConnection(): Promise<void> {
    const startTime = Date.now()
    
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn', 'info'] 
        : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    })

    // 測試連接
    await this.testConnection()
    
    this.connectionCount++
    this.isConnected = true
    this.lastConnectionTime = new Date()
    this.retryCount = 0

    const connectionTime = Date.now() - startTime
    console.log(`✅ 資料庫連接成功 (${connectionTime}ms)`)
  }

  private async testConnection(): Promise<void> {
    if (!this.prisma) {
      throw new Error('Prisma 客戶端未初始化')
    }

    // 執行簡單查詢測試連接
    await this.prisma.$queryRaw`SELECT 1`
  }

  private async handleConnectionError(error: any): Promise<void> {
    this.retryCount++
    this.isConnected = false

    console.error(`❌ 資料庫連接錯誤 (嘗試 ${this.retryCount}/${CONNECTION_POOL_CONFIG.retryAttempts}):`, error.message)

    // 如果還有重試機會
    if (this.retryCount < CONNECTION_POOL_CONFIG.retryAttempts) {
      const delay = CONNECTION_POOL_CONFIG.retryDelay * this.retryCount
      console.log(`⏳ ${delay}ms 後重試連接...`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
      
      try {
        await this.createConnection()
      } catch (retryError) {
        console.error('❌ 重試連接失敗:', retryError)
        throw retryError
      }
    } else {
      console.error('❌ 達到最大重試次數，連接失敗')
      throw new Error('資料庫連接失敗，請稍後再試')
    }
  }

  async closeConnection(): Promise<void> {
    if (this.prisma) {
      try {
        await this.prisma.$disconnect()
        console.log('✅ 資料庫連接已關閉')
      } catch (error) {
        console.error('❌ 關閉資料庫連接時發生錯誤:', error)
      } finally {
        this.prisma = null
        this.isConnected = false
        this.connectionCount = Math.max(0, this.connectionCount - 1)
      }
    }
  }

  // 健康檢查
  async healthCheck(): Promise<{
    isConnected: boolean
    connectionCount: number
    lastConnectionTime: Date | null
    retryCount: number
  }> {
    if (this.prisma && this.isConnected) {
      try {
        await this.testConnection()
        return {
          isConnected: true,
          connectionCount: this.connectionCount,
          lastConnectionTime: this.lastConnectionTime,
          retryCount: this.retryCount
        }
      } catch (error) {
        this.isConnected = false
        console.error('❌ 健康檢查失敗:', error)
      }
    }

    return {
      isConnected: false,
      connectionCount: this.connectionCount,
      lastConnectionTime: this.lastConnectionTime,
      retryCount: this.retryCount
    }
  }

  // 獲取連接統計
  getConnectionStats() {
    return {
      connectionCount: this.connectionCount,
      isConnected: this.isConnected,
      lastConnectionTime: this.lastConnectionTime,
      retryCount: this.retryCount,
      maxConnections: CONNECTION_POOL_CONFIG.maxConnections
    }
  }
}

// 導出單例實例
export const dbManager = DatabaseConnectionManager.getInstance()

// 導出便捷的連接函數
export async function getDatabaseConnection(): Promise<PrismaClient> {
  return await dbManager.getConnection()
}

// 導出健康檢查函數
export async function checkDatabaseHealth() {
  return await dbManager.healthCheck()
}

// 導出統計信息函數
export function getDatabaseStats() {
  return dbManager.getConnectionStats()
}