import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    console.log('Testing simple ranking...')
    
    // 檢查環境變數
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 })
    }

    // 簡單測試：獲取所有夥伴和預約
    const { allPartners, allBookings } = await db.query(async (client) => {
      const partners = await client.partner.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          isAvailableNow: true,
          isRankBooster: true
        }
      });

      const bookings = await client.booking.findMany({
        select: {
          id: true,
          status: true,
          scheduleId: true
        }
      });

      return { allPartners: partners, allBookings: bookings };
    });

    console.log(`Found ${allPartners.length} total partners`)

    // 獲取已批准的夥伴
    const approvedPartners = allPartners.filter(p => p.status === 'APPROVED')
    console.log(`Found ${approvedPartners.length} approved partners`)

    console.log(`Found ${allBookings.length} total bookings`)

    // 獲取已確認和已完成的預約
    const confirmedBookings = allBookings.filter(b => 
      b.status === 'CONFIRMED' || b.status === 'COMPLETED'
    )

    console.log(`Found ${confirmedBookings.length} confirmed/completed bookings`)

    // 創建簡單的排行榜數據
    const rankingData = approvedPartners.map((partner, index) => ({
      id: partner.id,
      name: partner.name,
      games: ['LOL', '傳說對決'], // 預設遊戲
      totalMinutes: Math.floor(Math.random() * 1000) + 100, // 隨機時長
      coverImage: null,
      isAvailableNow: partner.isAvailableNow,
      isRankBooster: partner.isRankBooster,
      rank: index + 1
    }))

    return NextResponse.json({
      success: true,
      message: 'Simple ranking test successful',
      data: {
        totalPartners: allPartners.length,
        approvedPartners: approvedPartners.length,
        totalBookings: allBookings.length,
        confirmedBookings: confirmedBookings.length,
        rankingData: rankingData
      }
    })

  } catch (error) {
    console.error('Simple ranking test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        databaseUrl: process.env.DATABASE_URL ? 'Configured' : 'Not configured'
      }
    }, { status: 500 })
  }
} 