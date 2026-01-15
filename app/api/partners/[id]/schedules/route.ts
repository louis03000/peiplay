import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";
import { BookingStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 終止狀態（不佔用時段）
const TERMINAL_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
  BookingStatus.REJECTED,
  BookingStatus.PARTNER_REJECTED,
  BookingStatus.COMPLETED_WITH_AMOUNT_MISMATCH,
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const partnerId = resolvedParams.id;
    const url = request.nextUrl;

    if (!partnerId) {
      return NextResponse.json({ error: '缺少 partnerId' }, { status: 400 });
    }

    // ⚠️ 僅作為「startTime 範圍」使用，不再碰 schedule.date
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    let startTimeRange: any = undefined;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      startTimeRange = {
        gte: start,
        lte: end,
      };
    }

    const schedules = await db.query(async (client) => {
      const now = new Date();

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

      if (!partner || partner.status !== 'APPROVED') return [];

      if (
        partner.user?.isSuspended &&
        partner.user.suspensionEndsAt &&
        partner.user.suspensionEndsAt > now
      ) {
        return [];
      }

      // 所有活躍預約
      const allActiveBookings = await client.booking.findMany({
        where: {
          schedule: { partnerId },
          status: { notIn: TERMINAL_BOOKING_STATUSES },
        },
        select: {
          id: true,
          scheduleId: true,
          schedule: {
            select: {
              startTime: true,
              endTime: true,
            },
          },
        },
      });

      const bookedScheduleIds = new Set(
        allActiveBookings.map(b => b.scheduleId).filter(Boolean)
      );

      const whereClause: any = {
        partnerId,
        isAvailable: true,
      };

      // ✅ 改成用 startTime（不是 date）
      if (startTimeRange) {
        whereClause.startTime = startTimeRange;
      }

      const allSchedules = await client.schedule.findMany({
        where: whereClause,
        select: {
          id: true,
          startTime: true,
          endTime: true,
          isAvailable: true,
          bookings: {
            select: { status: true },
          },
        },
        orderBy: { startTime: 'asc' },
      });

      const terminalStatusSet = new Set(TERMINAL_BOOKING_STATUSES);

      const filteredSchedules = allSchedules.filter(schedule => {
        // 一對一預約
        if (schedule.bookings) {
          if (!terminalStatusSet.has(schedule.bookings.status)) {
            return false;
          }
        }

        // 群組 / 多人陪玩
        if (bookedScheduleIds.has(schedule.id)) {
          return false;
        }

        const sStart = new Date(schedule.startTime).getTime();
        const sEnd = new Date(schedule.endTime).getTime();

        // 檢查重疊
        for (const booking of allActiveBookings) {
          if (!booking.schedule) continue;
          const bStart = new Date(booking.schedule.startTime).getTime();
          const bEnd = new Date(booking.schedule.endTime).getTime();

          if (sStart < bEnd && bStart < sEnd) {
            return false;
          }
        }

        return true;
      });

      return filteredSchedules;
    }, 'partners:schedules');

    return NextResponse.json({ schedules }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error) {
    return createErrorResponse(error, 'partners:schedules');
  }
}