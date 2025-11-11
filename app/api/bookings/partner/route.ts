import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

      const rows = await client.booking.findMany({
        where: {
          schedule: { partnerId: partner.id },
        },
        include: {
          customer: { select: { name: true } },
          schedule: {
            select: {
              startTime: true,
              endTime: true,
              date: true,
              partnerId: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
      });

      const now = Date.now();

      const filtered = rows.filter((booking) => {
        if (EXCLUDED_STATUSES.has(booking.status)) {
          return false;
        }
        const endTime = new Date(booking.schedule.endTime).getTime();
        const buffer = booking.status === WAITING_STATUS ? 30 * 60 * 1000 : 0;
        return endTime >= now - buffer;
      });

      return filtered;
    }, 'bookings:partner');

    if (bookings === null) {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
    }

    return NextResponse.json({ bookings });
  } catch (error) {
    return createErrorResponse(error, 'bookings:partner');
  }
} 