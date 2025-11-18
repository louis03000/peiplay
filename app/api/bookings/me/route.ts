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

      // 返回所有狀態的預約，用於 profile 頁面顯示
      const allBookings = await client.booking.findMany({
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
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      // 限制最多50筆，超過則刪除最早的
      if (allBookings.length > 50) {
        const bookingsToDelete = allBookings.slice(50);
        const idsToDelete = bookingsToDelete.map(b => b.id);
        
        // 刪除超過50筆的預約
        await client.booking.deleteMany({
          where: {
            id: { in: idsToDelete },
          },
        });

        // 只返回前50筆
        return allBookings.slice(0, 50);
      }

      return allBookings;
    }, 'bookings:me');

    if (result === null) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    return NextResponse.json({ bookings: result });
  } catch (error) {
    return createErrorResponse(error, 'bookings:me');
  }
}