import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log("🔍 Health check API triggered");
    
    // 檢查資料庫連線
    await prisma.$connect();
    
    // 簡單的資料庫查詢測試
    const userCount = await prisma.user.count();
    const partnerCount = await prisma.partner.count();
    const bookingCount = await prisma.booking.count();
    const groupBookingCount = await prisma.groupBooking.count();
    
    console.log("📊 Database health check:", {
      users: userCount,
      partners: partnerCount,
      bookings: bookingCount,
      groupBookings: groupBookingCount
    });

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        users: userCount,
        partners: partnerCount,
        bookings: bookingCount,
        groupBookings: groupBookingCount
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
  } finally {
    // 確保斷開連線
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}