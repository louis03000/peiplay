import { prisma } from './db/client'

// 資料庫操作的安全包裝器
export class DatabaseManager {
  // 檢查資料庫連接
  static async checkConnection() {
    try {
      await prisma.$connect()
      const userCount = await prisma.user.count()
      return { success: true, userCount }
    } catch (error) {
      console.error('Database connection failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    } finally {
      // ⚠️ 注意：在 Serverless 環境中不應 disconnect
      // 只有在應用關閉時才應 disconnect
    }
  }

  // 獲取資料庫統計資訊
  static async getStatistics() {
    try {
      const [userCount, customerCount, partnerCount, scheduleCount, bookingCount] = await Promise.all([
        prisma.user.count(),
        prisma.customer.count(),
        prisma.partner.count(),
        prisma.schedule.count(),
        prisma.booking.count(),
      ])

      return {
        users: userCount,
        customers: customerCount,
        partners: partnerCount,
        schedules: scheduleCount,
        bookings: bookingCount,
      }
    } catch (error) {
      console.error('Failed to get database statistics:', error)
      throw error
    }
  }

  // 檢查是否有重要資料
  static async hasImportantData() {
    try {
      const userCount = await prisma.user.count()
      const partnerCount = await prisma.partner.count()
      
      return {
        hasUsers: userCount > 0,
        hasPartners: partnerCount > 0,
        userCount,
        partnerCount,
      }
    } catch (error) {
      console.error('Failed to check important data:', error)
      return {
        hasUsers: false,
        hasPartners: false,
        userCount: 0,
        partnerCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // 安全的資料庫重置（僅在開發環境）
  static async safeReset() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database reset is not allowed in production')
    }

    try {
      // 檢查是否有重要資料
      const dataCheck = await this.hasImportantData()
      
      if (dataCheck.hasUsers || dataCheck.hasPartners) {
        console.warn('Database contains important data. Reset cancelled.')
        return {
          success: false,
          message: 'Database contains important data. Reset cancelled.',
          dataCheck,
        }
      }

      // 執行重置
      await prisma.booking.deleteMany()
      await prisma.schedule.deleteMany()
      await prisma.customer.deleteMany()
      await prisma.partner.deleteMany()
      await prisma.user.deleteMany()

      return {
        success: true,
        message: 'Database reset completed successfully',
      }
    } catch (error) {
      console.error('Database reset failed:', error)
      throw error
    }
  }
} 