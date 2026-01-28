import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0; // 禁用快取

/** 我的訂單僅顯示「已付款成功」的預約；排除待付款、待確認等 */
const PAID_OR_AFTER_STATUSES = ['PAID_WAITING_PARTNER_CONFIRMATION', 'CONFIRMED', 'PARTNER_ACCEPTED'];
const WAITING_STATUS = 'PAID_WAITING_PARTNER_CONFIRMATION';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const bookings = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!partner) {
        return null;
      }

      // 優化：使用 select 而非 include，只查詢必要欄位
      // 僅顯示「已付款成功」的預約（PAID_WAITING 及以上）；不顯示 PENDING、PENDING_PAYMENT
      const rows = await client.booking.findMany({
        where: {
          schedule: { partnerId: partner.id },
          status: { in: PAID_OR_AFTER_STATUSES },
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          finalAmount: true,
          rejectReason: true,
          paymentInfo: true,
          groupBookingId: true,
          multiPlayerBookingId: true,
          serviceType: true,
          partnerResponseDeadline: true,
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          schedule: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              date: true,
              partnerId: true,
              partner: {
                select: {
                  supportsChatOnly: true,
                  chatOnlyRate: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 50, // 減少為 50 筆，提升速度
      });

      const now = Date.now();

      // 過濾掉已過期的預約（保留等待確認的預約，給30分鐘緩衝）
      const filtered = rows.filter((booking) => {
        const endTime = new Date(booking.schedule.endTime).getTime();
        const buffer = booking.status === WAITING_STATUS ? 30 * 60 * 1000 : 0;
        return endTime >= now - buffer;
      });

      // 為每個預約添加服務類型
      const processedBookings = filtered.map((booking) => {
        let serviceType = '一般預約'; // 預設值
        
        // 判斷服務類型（與 admin/order-records 邏輯一致）
        const paymentInfo = booking.paymentInfo as any
        const isInstantBooking = paymentInfo?.isInstantBooking === true || paymentInfo?.isInstantBooking === 'true';
        
        // 🔥 判斷是否是純聊天（只有明確選擇純聊天篩選器時才是純聊天）
        // 必須在創建預約時明確標記為純聊天，不能僅因為夥伴支持純聊天就判斷為純聊天
        const isChatOnly = 
          booking.serviceType === 'CHAT_ONLY' || 
          paymentInfo?.isChatOnly === true || 
          paymentInfo?.isChatOnly === 'true';
        
        // 🔥 優先檢查多人陪玩（因為它可能同時有 paymentInfo）
        if (booking.multiPlayerBookingId) {
          serviceType = '多人陪玩'
        } else if (booking.groupBookingId) {
          serviceType = '群組預約'
        } else if (isChatOnly) {
          // 🔥 純聊天優先於即時預約（包括即時預約的純聊天）
          serviceType = '純聊天'
        } else if (isInstantBooking) {
          serviceType = '即時預約'
        }
        
        // 🔥 調試信息（僅在開發環境）
        if (process.env.NODE_ENV === 'development') {
          console.log(`[bookings/partner] 預約 ${booking.id} 服務類型判斷:`, {
            multiPlayerBookingId: booking.multiPlayerBookingId,
            groupBookingId: booking.groupBookingId,
            isInstantBooking: paymentInfo?.isInstantBooking,
            isChatOnly: paymentInfo?.isChatOnly,
            serviceType: booking.serviceType,
            supportsChatOnly: booking.schedule?.partner?.supportsChatOnly,
            chatOnlyRate: booking.schedule?.partner?.chatOnlyRate,
            result: serviceType
          })
        }
        
        return {
          ...booking,
          serviceType,
          isInstantBooking, // 添加 isInstantBooking 字段，供前端判断是否同时显示"即時預約"
        }
      });

      return processedBookings;
    }, 'bookings:partner');

    if (bookings === null) {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
    }

    // 禁用快取，確保即時反映最新狀態
    return NextResponse.json(
      { bookings },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    return createErrorResponse(error, 'bookings:partner');
  }
} 