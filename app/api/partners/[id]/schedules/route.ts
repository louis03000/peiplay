import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";
import { BookingStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 定義終止狀態：這些狀態的預約不會佔用時段
const TERMINAL_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
  BookingStatus.REJECTED,
  BookingStatus.PARTNER_REJECTED,
  BookingStatus.COMPLETED_WITH_AMOUNT_MISMATCH,
];

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

        // 查詢所有可用時段（包含預約資訊）
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

        // 在應用層過濾：只返回沒有預約或預約狀態是終止狀態的時段
        const terminalStatusSet = new Set(TERMINAL_BOOKING_STATUSES);
        return allSchedules.filter((schedule) => {
          // 沒有預約，可以選擇
          if (!schedule.bookings) {
            return true;
          }
          // 有預約，檢查狀態是否為終止狀態
          return terminalStatusSet.has(schedule.bookings.status);
        });
      },
      'partners:schedules'
    );

    if (schedules === null) {
      return NextResponse.json({ error: '找不到夥伴' }, { status: 404 });
    }

    return NextResponse.json({ schedules }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'partners:schedules');
  }
}

