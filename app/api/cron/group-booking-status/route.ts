import { NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';

// 群組預約狀態自動管理
export async function GET() {
  try {
    const now = new Date();
    
    const result = await db.query(async (client) => {
      // 1. 處理開始前10分鐘的群組（關閉群組，創建文字頻道）
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
      const groupsToClose = await client.groupBooking.findMany({
      where: {
        status: 'ACTIVE',
        startTime: {
          lte: tenMinutesFromNow,
          gt: now
        }
      },
      include: {
        bookings: {
          include: {
            customer: {
              include: { user: true }
            }
          }
        }
      }
    });

      for (const group of groupsToClose) {
        // 檢查文字頻道是否已存在
        if (group.discordTextChannelId) {
          console.log(`⚠️ 群組 ${group.id} 的文字頻道已存在，跳過創建`);
          // 如果文字頻道已存在但狀態不是 FULL，更新狀態
          if (group.status !== 'FULL') {
            await client.groupBooking.update({
              where: { id: group.id },
              data: { status: 'FULL' }
            });
          }
          continue;
        }

        // 關閉群組（不再接受新成員）
        await client.groupBooking.update({
          where: { id: group.id },
          data: { status: 'FULL' }
        });

        // 創建文字頻道
        try {
          console.log(`🔍 開始為群組 ${group.id} 創建文字頻道...`);
          const response = await fetch(`${process.env.NEXTAUTH_URL}/api/discord/group-channels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              groupBookingId: group.id,
              action: 'create_text_channel'
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`✅ 群組 ${group.id} 文字頻道創建成功:`, result);
          } else {
            const error = await response.json();
            console.error(`❌ 群組 ${group.id} 文字頻道創建失敗:`, error);
          }
        } catch (error) {
          console.error(`❌ 群組 ${group.id} 創建文字頻道時發生錯誤:`, error);
        }
      }

      // 2. 處理開始前5分鐘的群組（創建語音頻道）
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      const groupsForVoice = await client.groupBooking.findMany({
      where: {
        status: 'FULL',
        startTime: {
          lte: fiveMinutesFromNow,
          gt: now
        },
        discordTextChannelId: { not: null },
        discordVoiceChannelId: null
      }
    });

    for (const group of groupsForVoice) {
      // 再次檢查語音頻道是否已存在（防止重複創建）
      if (group.discordVoiceChannelId) {
        console.log(`⚠️ 群組 ${group.id} 的語音頻道已存在，跳過創建`);
        continue;
      }

      // 創建語音頻道
      try {
        console.log(`🔍 開始為群組 ${group.id} 創建語音頻道...`);
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/discord/group-channels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupBookingId: group.id,
            action: 'create_voice_channel'
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`✅ 群組 ${group.id} 語音頻道創建成功:`, result);
        } else {
          const error = await response.json();
          console.error(`❌ 群組 ${group.id} 語音頻道創建失敗:`, error);
        }
      } catch (error) {
        console.error(`❌ 群組 ${group.id} 創建語音頻道時發生錯誤:`, error);
      }
    }

      // 3. 處理已結束的群組（發送評價系統，不立即刪除頻道）
      const endedGroups = await client.groupBooking.findMany({
        where: {
          status: { in: ['FULL', 'ACTIVE'] },
          endTime: { lte: now }
        },
        include: {
          GroupBookingReview: true
        }
      });

      for (const group of endedGroups) {
        // 檢查是否已經發送過評價系統
        const hasReviews = group.GroupBookingReview && group.GroupBookingReview.length > 0;
        const hasTextChannel = group.discordTextChannelId !== null;
        
        // 如果還沒有發送評價系統且有文字頻道，發送評價系統
        if (!hasReviews && hasTextChannel) {
          try {
            console.log(`🔍 開始為群組 ${group.id} 發送評價系統...`);
            await fetch(`${process.env.NEXTAUTH_URL}/api/discord/group-channels`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                groupBookingId: group.id,
                action: 'send_review_system'
              })
            });
            console.log(`✅ 群組 ${group.id} 評價系統已發送`);
          } catch (error) {
            console.error(`❌ 群組 ${group.id} 發送評價系統時發生錯誤:`, error);
          }
        }
        
        // 如果已經有評價或超過15分鐘，刪除語音頻道（保留文字頻道直到評價完成）
        const endTime = new Date(group.endTime);
        const fifteenMinutesAfterEnd = new Date(endTime.getTime() + 15 * 60 * 1000);
        const shouldDeleteVoice = now >= fifteenMinutesAfterEnd || hasReviews;
        
        if (shouldDeleteVoice && group.discordVoiceChannelId) {
          try {
            await fetch(`${process.env.NEXTAUTH_URL}/api/discord/group-channels`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                groupBookingId: group.id,
                action: 'delete_voice_channel'
              })
            });
          } catch (error) {
            console.error('Error deleting voice channel for group:', group.id, error);
          }
        }
        
        // 如果已經有評價或超過15分鐘，刪除文字頻道並標記為完成
        if (shouldDeleteVoice) {
          try {
            await fetch(`${process.env.NEXTAUTH_URL}/api/discord/group-channels`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                groupBookingId: group.id,
                action: 'delete_text_channel'
              })
            });
          } catch (error) {
            console.error('Error deleting text channel for group:', group.id, error);
          }
          
          // 標記群組預約為完成
          await client.groupBooking.update({
            where: { id: group.id },
            data: { status: 'COMPLETED' }
          });

          // 🔥 更新相關的 Booking 記錄為 COMPLETED 並計算推薦收入
          const groupBookings = await client.booking.findMany({
            where: {
              groupBookingId: group.id,
              status: { not: 'COMPLETED' }
            }
          });

          for (const booking of groupBookings) {
            try {
              // 更新 Booking 狀態為 COMPLETED
              await client.booking.update({
                where: { id: booking.id },
                data: { status: 'COMPLETED' }
              });

              // 計算推薦收入（非阻塞，使用 fetch）
              fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/partners/referral/calculate-earnings`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bookingId: booking.id }),
              })
                .then((referralResponse) => {
                  if (referralResponse.ok) {
                    console.log(`✅ 群組預約 Booking ${booking.id} 推薦收入計算成功`);
                  } else {
                    referralResponse.json().then((error) => {
                      console.warn(`⚠️ 群組預約 Booking ${booking.id} 推薦收入計算失敗:`, error);
                    });
                  }
                })
                .catch((error) => {
                  console.error(`❌ 群組預約 Booking ${booking.id} 推薦收入計算錯誤:`, error);
                });

              console.log(`✅ 群組預約 Booking ${booking.id} 已標記為完成`);
            } catch (error) {
              console.error(`❌ 處理群組預約 Booking ${booking.id} 時發生錯誤:`, error);
            }
          }
        }
      }

      return {
        success: true,
        closed: groupsToClose.length,
        voiceChannels: groupsForVoice.length,
        completed: endedGroups.length
      };
    }, 'cron/group-booking-status')

    return NextResponse.json(result);

  } catch (error) {
    console.error('Group booking status automation error:', error);
    return NextResponse.json({ error: 'Automation failed' }, { status: 500 });
  }
}
