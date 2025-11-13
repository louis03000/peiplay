import { NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log("🔍 Health check API triggered");
    
    // 簡單的資料庫查詢測試
    const counts = await db.query(async (client) => {
      const [userCount, partnerCount, bookingCount, groupBookingCount] = await Promise.all([
        client.user.count(),
        client.partner.count(),
        client.booking.count(),
        client.groupBooking.count()
      ]);
      return { userCount, partnerCount, bookingCount, groupBookingCount };
    });
    
    console.log("📊 Database health check:", counts);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        users: counts.userCount,
        partners: counts.partnerCount,
        bookings: counts.bookingCount,
        groupBookings: counts.groupBookingCount
      }
    });

  } catch (error) {
    console.error("❌ Health check failed:", error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}