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

      // 優化：使用 select 而非 include，只查詢必要欄位
      const rows = await client.booking.findMany({
        where: {
          schedule: { partnerId: partner.id },
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          finalAmount: true,
          rejectReason: true,
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

    // 個人資料使用 private cache（只快取在用戶瀏覽器中）
    return NextResponse.json(
      { bookings },
      {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        },
      }
    );
  } catch (error) {
    return createErrorResponse(error, 'bookings:partner');
  }
} 