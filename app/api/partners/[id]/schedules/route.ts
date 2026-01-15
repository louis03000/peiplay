import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";
import { BookingStatus } from "@prisma/client";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(timezone);
dayjs.extend(utc);

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

    // 🔥 使用台灣時區計算今天的開始時間，確保凌晨時段也能正確顯示
    const nowTaipei = dayjs().tz('Asia/Taipei');
    const todayStartTaipei = nowTaipei.startOf('day').toDate();
    
    // 解析日期範圍
    let scheduleDateFilter: any = { gte: todayStartTaipei };
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
        // 🔥 獲取當前時間（用於停權檢查）
        const now = new Date();
        
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

        // 🔥 首先獲取當前時間（用於數據庫查詢和過濾）
        const currentTimeMs = Date.now();
        const currentTime = new Date(currentTimeMs);

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
        // 🔥 移除資料庫層面的 startTime 過濾，讓前端根據選擇的日期決定是否過濾已過期時段
        // 這樣前端可以根據用戶選擇「今天」或「未來日期」來決定是否顯示已過期時段
        const allSchedules = await client.schedule.findMany({
          where: {
            partnerId,
            isAvailable: true,
            date: scheduleDateFilter,
            // 注意：不在此處過濾 startTime，讓前端處理過期判斷
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
        
        // 🔍 調試：檢查所有時段的時間分布
        if (allSchedules.length > 0) {
          // 檢查前10個和後10個時段
          const sampleSchedules = [
            ...allSchedules.slice(0, 5),
            ...allSchedules.slice(-5)
          ];
          console.log(`[API] 檢查樣本時段 (總共 ${allSchedules.length} 個，顯示前5個和後5個):`);
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
          
          // 🔍 統計：找出所有已過期的時段
          const pastSchedules = allSchedules.filter(s => {
            const sStart = s.startTime instanceof Date ? s.startTime : new Date(s.startTime);
            return sStart.getTime() <= currentTimeMs;
          });
          if (pastSchedules.length > 0) {
            console.log(`[API] ⚠️ 發現 ${pastSchedules.length} 個已過期時段，前5個:`);
            pastSchedules.slice(0, 5).forEach((s, idx) => {
              const sStart = s.startTime instanceof Date ? s.startTime : new Date(s.startTime);
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
              const timeDiff = Math.round((currentTimeMs - sStart.getTime()) / 1000 / 60);
              console.log(`[API] 已過期時段 ${idx + 1}: ID=${s.id}, 台灣時間=${sStartTW}, 已過期 ${timeDiff} 分鐘`);
            });
          } else {
            console.log(`[API] ✅ 所有時段都未過期`);
          }
        }
        
        // 🔥 移除應用層的過期過濾，讓前端根據選擇的日期決定是否過濾已過期時段
        // 前端會根據用戶選擇「今天」或「未來日期」來決定是否顯示已過期時段
        const filteredSchedules = allSchedules.filter((schedule) => {
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
          const scheduleStart = schedule.startTime instanceof Date ? schedule.startTime : new Date(schedule.startTime);
          const scheduleEnd = schedule.endTime instanceof Date ? schedule.endTime : new Date(schedule.endTime);
          
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
        
        console.log(`✅ 查詢到 ${allSchedules.length} 個時段，過濾後剩餘 ${filteredSchedules.length} 個可用時段（過期判斷由前端處理）`);
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

