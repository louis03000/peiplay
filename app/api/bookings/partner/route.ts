import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0; // 禁用快取

const EXCLUDED_STATUSES = new Set(['CANCELLED', 'REJECTED', 'COMPLETED']);
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
      // 直接在查詢時過濾掉已取消、已拒絕、已完成的預約
      const rows = await client.booking.findMany({
        where: {
          schedule: { partnerId: partner.id },
          status: {
            notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'],
          },
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
        
        // 🔥 優先檢查多人陪玩（因為它可能同時有 paymentInfo）
        if (booking.multiPlayerBookingId) {
          serviceType = '多人陪玩'
        } else if (paymentInfo?.isInstantBooking === true || paymentInfo?.isInstantBooking === 'true') {
          serviceType = '即時預約'
        } else if (booking.groupBookingId) {
          serviceType = '群組預約'
        } else if (booking.serviceType === 'CHAT_ONLY') {
          serviceType = '純聊天'
        }
        
        // 🔥 調試信息（僅在開發環境）
        if (process.env.NODE_ENV === 'development') {
          console.log(`[bookings/partner] 預約 ${booking.id} 服務類型判斷:`, {
            multiPlayerBookingId: booking.multiPlayerBookingId,
            groupBookingId: booking.groupBookingId,
            isInstantBooking: paymentInfo?.isInstantBooking,
            serviceType: booking.serviceType,
            result: serviceType
          })
        }
        
        return {
          ...booking,
          serviceType,
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