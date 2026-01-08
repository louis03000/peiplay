import { NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';
import { BookingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// 自動將已結束的 CONFIRMED 預約標記為 COMPLETED 並計算推薦收入
export async function GET() {
  try {
    const now = new Date();
    
    const result = await db.query(async (client) => {
      // 查找已結束但狀態仍為 CONFIRMED 或 PARTNER_ACCEPTED 的預約（排除群組預約，群組預約由 group-booking-status 處理）
      const endedBookings = await client.booking.findMany({
        where: {
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.PARTNER_ACCEPTED]
          },
          schedule: {
            endTime: {
              lte: now
            }
          },
          // 排除群組預約，群組預約由 group-booking-status cron job 處理
          isGroupBooking: { not: true }
        },
        include: {
          schedule: {
            include: {
              partner: {
                include: {
                  user: true
                }
              }
            }
          },
          customer: {
            include: {
              user: true
            }
          }
        }
      });

      let completedCount = 0;
      let referralCalculatedCount = 0;

      for (const booking of endedBookings) {
        try {
          // 更新預約狀態為 COMPLETED
          await client.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.COMPLETED }
          });

          completedCount++;

          // 計算推薦收入
          try {
            const referralResponse = await fetch(
              `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/partners/referral/calculate-earnings`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bookingId: booking.id }),
              }
            );

            if (referralResponse.ok) {
              referralCalculatedCount++;
              console.log(`✅ 預約 ${booking.id} 推薦收入計算成功`);
            } else {
              const error = await referralResponse.json();
              console.warn(`⚠️ 預約 ${booking.id} 推薦收入計算失敗:`, error);
            }
          } catch (referralError) {
            console.error(`❌ 預約 ${booking.id} 推薦收入計算錯誤:`, referralError);
          }

          console.log(`✅ 預約 ${booking.id} 已標記為完成（結束時間：${booking.schedule.endTime.toISOString()}）`);
        } catch (error) {
          console.error(`❌ 處理預約 ${booking.id} 時發生錯誤:`, error);
        }
      }

      return {
        success: true,
        completed: completedCount,
        referralCalculated: referralCalculatedCount,
        message: `已處理 ${completedCount} 個已結束的預約，計算了 ${referralCalculatedCount} 個推薦收入`
      };
    }, 'cron/complete-bookings');

    return NextResponse.json(result);
  } catch (error) {
    console.error('自動完成預約錯誤:', error);
    return NextResponse.json({ error: 'Automation failed' }, { status: 500 });
  }
}
