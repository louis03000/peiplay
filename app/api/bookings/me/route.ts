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

      // 優化策略：
      // 1. 直接限制查詢結果為 50 筆，避免載入過多資料
      // 2. 使用 select 只查詢必要欄位
      // 3. 使用索引優化的排序
      // 4. 移除不必要的 customer 查詢（我們已經知道 customerId）
      
      // 直接限制為 50 筆，避免後續刪除操作（刪除操作很慢）
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
          reviews: {
            select: {
              id: true,
              reviewerId: true,
            },
          },
          // 移除 customer 查詢，因為我們已經知道 customerId
        },
        // 使用 createdAt DESC 排序，利用索引
        orderBy: { createdAt: 'desc' },
        // 直接限制為 50 筆
        take: 50,
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