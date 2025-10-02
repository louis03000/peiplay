import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    // 檢查資料庫連接
    await prisma.$connect()
    
    // 獲取各表的統計資料
    const userCount = await prisma.user.count()
    const customerCount = await prisma.customer.count()
    const partnerCount = await prisma.partner.count()
    const scheduleCount = await prisma.schedule.count()
    const bookingCount = await prisma.booking.count()
    const orderCount = await prisma.order.count()
    const reviewCount = await prisma.review.count()

    // 檢查最近的用戶
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    })

    // 檢查環境變數（不顯示敏感資訊）
    const dbUrl = process.env.DATABASE_URL || 'Not set'
    const dbUrlPreview = dbUrl.length > 20 ? dbUrl.substring(0, 20) + '...' : dbUrl

    return NextResponse.json({
      database: {
        connection: 'Connected',
        url: dbUrlPreview,
        timestamp: new Date().toISOString()
      },
      statistics: {
        users: userCount,
        customers: customerCount,
        partners: partnerCount,
        schedules: scheduleCount,
        bookings: bookingCount,
        orders: orderCount,
        reviews: reviewCount
      },
      recentUsers: recentUsers,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL
      }
    })
  } catch (error) {
    console.error('Database status check error:', error)
    return NextResponse.json({
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
} 