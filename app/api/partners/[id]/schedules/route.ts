import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";
import { BookingStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 定義終止狀態：這些狀態的預約不會佔用時段
const TERMINAL_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
  BookingStatus.REJECTED,
  BookingStatus.PARTNER_REJECTED,
  BookingStatus.COMPLETED_WITH_AMOUNT_MISMATCH,
];

/**
 * 查詢單一夥伴的可用時段（預約 Step 2）
 * 
 * 只在選擇夥伴後才查詢，避免列表階段載入過多資料
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const partnerId = resolvedParams.id;
    const url = request.nextUrl;
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!partnerId) {
      return NextResponse.json({ error: '缺少 partnerId' }, { status: 400 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 解析日期範圍
    let scheduleDateFilter: any = { gte: todayStart };
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // 使用 lte 而不是 lt，確保包含最後一天的時段
      // 將 endDate 設置為該日的最後時刻（23:59:59.999）
      end.setHours(23, 59, 59, 999);
      scheduleDateFilter = {
        gte: start,
        lte: end,
      };
    }

    const schedules = await db.query(
      async (client) => {
        // 驗證夥伴存在
        const partner = await client.partner.findUnique({
          where: { id: partnerId },
          select: {
            id: true,
            status: true,
            user: {
              select: {
                isSuspended: true,
                suspensionEndsAt: true,
              },
            },
          },
        });

        if (!partner) {
          return null;
        }

        if (partner.status !== 'APPROVED') {
          return [];
        }

        // 檢查是否被停權
        if (partner.user?.isSuspended) {
          const endsAt = partner.user.suspensionEndsAt;
          if (endsAt && endsAt > now) {
            return [];
          }
        }

        // 🔥 查詢該夥伴所有活躍的預約（包括群組預約和多人陪玩的 Booking）
        const allActiveBookings = await client.booking.findMany({
          where: {
            schedule: {
              partnerId: partnerId,
            },
            status: {
              notIn: TERMINAL_BOOKING_STATUSES,
            },
          },
          select: {
            id: true,
            scheduleId: true,
            schedule: {
              select: {
                startTime: true,
                endTime: true,
              },
            },
          },
        });

        // 創建一個 Set 來快速查找已被預約的 scheduleId
        const bookedScheduleIds = new Set(allActiveBookings.map(b => b.scheduleId).filter(Boolean));

        // 查詢所有可用時段（包含預約資訊）
        // 移除 take 限制，確保所有日期範圍內的時段都被查詢到
        const allSchedules = await client.schedule.findMany({
          where: {
            partnerId,
            isAvailable: true,
            date: scheduleDateFilter,
          },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            isAvailable: true,
            bookings: {
              select: {
                status: true,
              },
            },
          },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        });

        // 在應用層過濾：只返回沒有預約或預約狀態是終止狀態的時段
        const terminalStatusSet = new Set(TERMINAL_BOOKING_STATUSES);
        // 🔥 使用 Date.now() 獲取當前 UTC 時間戳（毫秒），確保時間比較準確
        const currentTimeMs = Date.now();
        const currentTime = new Date(currentTimeMs);
        
        // 轉換為台灣時間用於日誌顯示
        const currentTimeTW = currentTime.toLocaleString('zh-TW', { 
          timeZone: 'Asia/Taipei',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        
        console.log(`[API] 過濾時段 - 當前時間 UTC: ${currentTime.toISOString()}, 台灣時間: ${currentTimeTW}, 時段總數: ${allSchedules.length}`);
        
        // 🔍 調試：檢查前幾個時段的時間
        if (allSchedules.length > 0) {
          const sampleSchedules = allSchedules.slice(0, 5);
          console.log(`[API] 檢查樣本時段 (總共 ${allSchedules.length} 個):`);
          sampleSchedules.forEach((s, idx) => {
            // 確保 startTime 是 Date 對象
            const sStart = s.startTime instanceof Date ? s.startTime : new Date(s.startTime);
            const sStartMs = sStart.getTime();
            const sStartTW = sStart.toLocaleString('zh-TW', { 
              timeZone: 'Asia/Taipei',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            });
            const isPast = sStartMs <= currentTimeMs;
            const timeDiff = isPast ? Math.round((currentTimeMs - sStartMs) / 1000 / 60) : Math.round((sStartMs - currentTimeMs) / 1000 / 60);
            console.log(`[API] 樣本時段 ${idx + 1}: ID=${s.id}, 開始時間 UTC=${sStart.toISOString()}, 台灣時間=${sStartTW}, 是否已過期=${isPast}, 時間差=${timeDiff}分鐘`);
          });
        }
        
        let pastCount = 0;
        const filteredSchedules = allSchedules.filter((schedule) => {
          // 0. 🔥 首先檢查時段是否已過去（必須在當前時間之後）
          // 確保 startTime 是 Date 對象
          const scheduleStart = schedule.startTime instanceof Date ? schedule.startTime : new Date(schedule.startTime);
          const scheduleStartMs = scheduleStart.getTime();
          
          // 🔥 嚴格檢查：如果時段開始時間 <= 當前時間，過濾掉
          // 注意：使用 <= 而不是 <，因為如果時段正好是當前時間，也應該被過濾
          if (scheduleStartMs <= currentTimeMs) {
            pastCount++;
            const timeDiffMinutes = Math.round((currentTimeMs - scheduleStartMs) / 1000 / 60);
            const scheduleStartTW = scheduleStart.toLocaleString('zh-TW', { 
              timeZone: 'Asia/Taipei',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            if (pastCount <= 10) { // 記錄前10個，幫助調試
              console.log(`🚫 時段 ${schedule.id} 已過去 (開始時間 UTC: ${scheduleStart.toISOString()}, 台灣時間: ${scheduleStartTW}, 當前時間 UTC: ${currentTime.toISOString()}, 台灣時間: ${currentTimeTW}, 相差: ${timeDiffMinutes} 分鐘)，已過濾`);
            }
            return false;
          }
          
          // 1. 檢查一對一預約
          if (schedule.bookings) {
            const isTerminal = terminalStatusSet.has(schedule.bookings.status);
            if (!isTerminal) {
              console.log(`🚫 時段 ${schedule.id} 有活躍預約 (狀態: ${schedule.bookings.status})，已過濾`);
              return false;
            }
          }
          
          // 2. 檢查是否有其他預約使用這個時段（群組、多人陪玩等）
          if (bookedScheduleIds.has(schedule.id)) {
            console.log(`🚫 時段 ${schedule.id} 已被其他預約使用（群組/多人陪玩），已過濾`);
            return false;
          }
          
          // 3. 檢查是否有任何預約與這個時段重疊
          const scheduleEnd = new Date(schedule.endTime);
          
          for (const activeBooking of allActiveBookings) {
            if (activeBooking.schedule) {
              const bookingStart = new Date(activeBooking.schedule.startTime);
              const bookingEnd = new Date(activeBooking.schedule.endTime);
              
              // 檢查是否有重疊
              if (scheduleStart.getTime() < bookingEnd.getTime() && 
                  bookingStart.getTime() < scheduleEnd.getTime()) {
                console.log(`🚫 時段 ${schedule.id} 與預約 ${activeBooking.id} 重疊，已過濾`);
                return false;
              }
            }
          }
          
          return true;
        });
        
        console.log(`✅ 查詢到 ${allSchedules.length} 個時段，已過期: ${pastCount} 個，過濾後剩餘 ${filteredSchedules.length} 個可用時段`);
        return filteredSchedules;
      },
      'partners:schedules'
    );

    if (schedules === null) {
      return NextResponse.json({ error: '找不到夥伴' }, { status: 404 });
    }

    return NextResponse.json({ schedules }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'partners:schedules');
  }
}

