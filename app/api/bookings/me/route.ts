import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED'];

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

      const bookings = await client.booking.findMany({
        where: {
          customerId: customer.id,
          status: { in: ACTIVE_STATUSES },
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
                select: { name: true },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
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