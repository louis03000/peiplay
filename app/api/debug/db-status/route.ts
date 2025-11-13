import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    // 獲取各表的統計資料和最近的用戶
    const { statistics, recentUsers } = await db.query(async (client) => {
      const [userCount, customerCount, partnerCount, scheduleCount, bookingCount, orderCount, reviewCount] = await Promise.all([
        client.user.count(),
        client.customer.count(),
        client.partner.count(),
        client.schedule.count(),
        client.booking.count(),
        client.order.count(),
        client.review.count()
      ]);

      // 檢查最近的用戶
      const recent = await client.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true
        }
      });

      return {
        statistics: {
          users: userCount,
          customers: customerCount,
          partners: partnerCount,
          schedules: scheduleCount,
          bookings: bookingCount,
          orders: orderCount,
          reviews: reviewCount
        },
        recentUsers: recent
      };
    });

    // 檢查環境變數（不顯示敏感資訊）
    const dbUrl = process.env.DATABASE_URL || 'Not set'
    const dbUrlPreview = dbUrl.length > 20 ? dbUrl.substring(0, 20) + '...' : dbUrl

    return NextResponse.json({
      database: {
        connection: 'Connected',
        url: dbUrlPreview,
        timestamp: new Date().toISOString()
      },
      statistics,
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
  }
} 