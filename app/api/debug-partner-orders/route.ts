import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 簡單的測試 API 來診斷問題
export async function GET() {
  try {
    console.log("🔍 DEBUG: partner orders test API triggered");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { partner, bookings } = await db.query(async (client) => {
      const partnerData = await client.partner.findUnique({
        where: { userId: session.user.id }
      });

      if (!partnerData) {
        throw new Error('夥伴資料不存在');
      }

      // 簡單查詢，不過濾時間
      const bookingsData = await client.booking.findMany({
        where: {
          schedule: {
            partnerId: partnerData.id
          }
        },
        include: {
          customer: {
            select: { name: true }
          },
          schedule: {
            select: {
              startTime: true,
              endTime: true,
              date: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { partner: partnerData, bookings: bookingsData };
    });

    const now = new Date();
    const validBookings = bookings.filter(booking => {
      const endTime = new Date(booking.schedule.endTime);
      return endTime >= now && !['CANCELLED', 'REJECTED', 'COMPLETED'].includes(booking.status);
    });

    console.log("🔍 DEBUG: 找到訂單:", {
      total: bookings.length,
      valid: validBookings.length,
      partnerId: partner.id,
      userId: session.user.id,
      currentTime: now.toISOString()
    });

    return NextResponse.json({ 
      success: true,
      totalBookings: bookings.length,
      validBookings: validBookings.length,
      bookings: validBookings,
      debug: {
        partnerId: partner.id,
        userId: session.user.id,
        currentTime: now.toISOString(),
        allBookings: bookings.map(b => ({
          id: b.id,
          status: b.status,
          endTime: b.schedule.endTime.toISOString(),
          customerName: b.customer.name
        }))
      }
    });

  } catch (error) {
    console.error('🔍 DEBUG: 測試 API 失敗:', error);
    if (error instanceof Error && error.message === '夥伴資料不存在') {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
    }
    return NextResponse.json({ 
      error: '測試 API 失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
