import { NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';
import { MultiPlayerBookingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// 多人陪玩群組狀態自動管理
export async function GET() {
  try {
    const now = new Date();
    
    const result = await db.query(async (client) => {
      // 處理已結束的多人陪玩群組（標記為完成）
      const endedBookings = await client.multiPlayerBooking.findMany({
        where: {
          status: { in: [MultiPlayerBookingStatus.ACTIVE, MultiPlayerBookingStatus.PENDING] },
          endTime: { lte: now }
        },
        include: {
          bookings: {
            select: {
              id: true,
              status: true,
            }
          }
        }
      });

      let completedCount = 0;

      for (const booking of endedBookings) {
        // 標記為完成
        await client.multiPlayerBooking.update({
          where: { id: booking.id },
          data: { status: MultiPlayerBookingStatus.COMPLETED }
        });
        
        completedCount++;
        console.log(`✅ 多人陪玩群組 ${booking.id} 已標記為完成（結束時間：${booking.endTime.toISOString()}）`);
      }

      return {
        success: true,
        completed: completedCount,
        message: `已處理 ${completedCount} 個過期的多人陪玩群組`
      };
    }, 'cron/multi-player-booking-status')

    return NextResponse.json(result);

  } catch (error) {
    console.error('多人陪玩群組狀態自動更新錯誤:', error);
    return NextResponse.json({ error: 'Automation failed' }, { status: 500 });
  }
}

