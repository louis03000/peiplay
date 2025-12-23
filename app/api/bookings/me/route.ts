import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { BookingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIVE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
  BookingStatus.REJECTED,
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const result = await db.query(async (client) => {
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!customer) {
        return null;
      }

      // 進一步優化策略：
      // 1. 直接限制查詢結果為 30 筆（減少資料量）
      // 2. 移除 reviews JOIN（如果不需要，可以通過其他 API 獲取）
      // 3. 只查詢最必要的欄位
      // 4. 使用索引優化的排序
      
      // 直接限制為 30 筆，減少資料傳輸和處理時間
      const bookings = await client.booking.findMany({
        where: {
          customerId: customer.id,
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          rejectReason: true,
          paymentInfo: true,
          groupBookingId: true,
          multiPlayerBookingId: true,
          serviceType: true,
          schedule: {
            select: {
              date: true,
              startTime: true,
              endTime: true,
              partner: {
                select: { 
                  id: true,
                  name: true,
                  userId: true,
                },
              },
            },
          },
          // 移除 reviews JOIN - 如果需要評價資訊，可以通過其他 API 獲取
          // 這會大幅減少查詢時間
        },
        // 使用 createdAt DESC 排序，利用索引
        orderBy: { createdAt: 'desc' },
        // 減少為 30 筆，提升速度
        take: 30,
      });

      // 為每個預約添加服務類型
      const processedBookings = bookings.map((booking) => {
        let serviceType = '一般預約'; // 預設值
        
        // 判斷服務類型（與 admin/order-records 邏輯一致）
        const paymentInfo = booking.paymentInfo as any
        if (paymentInfo?.isInstantBooking === true || paymentInfo?.isInstantBooking === 'true') {
          serviceType = '即時預約'
        } else if (booking.groupBookingId) {
          serviceType = '群組預約'
        } else if (booking.multiPlayerBookingId) {
          serviceType = '多人陪玩'
        } else if (booking.serviceType === 'CHAT_ONLY') {
          serviceType = '純聊天'
        }
        
        return {
          ...booking,
          serviceType,
        }
      });

      return processedBookings;
    }, 'bookings:me');

    if (result === null) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 個人資料使用 private cache（只在用戶瀏覽器中快取）
    return NextResponse.json(
      { bookings: result },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    return createErrorResponse(error, 'bookings:me');
  }
}