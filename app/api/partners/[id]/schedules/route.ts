import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";
import { BookingStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIVE_BOOKING_STATUSES: Set<BookingStatus> = new Set([
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
  BookingStatus.PARTNER_ACCEPTED,
]);

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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 解析日期範圍
    let scheduleDateFilter: any = { gte: todayStart };
    if (startDate && endDate) {
      scheduleDateFilter = {
        gte: new Date(startDate),
        lt: new Date(endDate),
      };
    }

    const schedules = await db.query(
      async (client) => {
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

        // 查詢可用時段
        const allSchedules = await client.schedule.findMany({
          where: {
            partnerId,
            isAvailable: true,
            date: scheduleDateFilter,
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
          take: 100, // 限制結果數量
        });

        // 應用層過濾：排除有活躍預約的時段
        return allSchedules.filter((schedule) => {
          if (!schedule.bookings) return true;
          const status = schedule.bookings.status;
          return !ACTIVE_BOOKING_STATUSES.has(status);
        });
      },
      'partners:schedules'
    );

    if (schedules === null) {
      return NextResponse.json({ error: '找不到夥伴' }, { status: 404 });
    }

    return NextResponse.json({ schedules }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'partners:schedules');
  }
}

