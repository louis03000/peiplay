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

      return bookings;
    }, 'bookings:me');

    if (result === null) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    return NextResponse.json({ bookings: result });
  } catch (error) {
    return createErrorResponse(error, 'bookings:me');
  }
}