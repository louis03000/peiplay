import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Handles the creation of new bookings.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.user.id },
  });

  if (!customer) {
    return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
  }

  const { scheduleIds } = await request.json();

  if (!scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    return NextResponse.json({ error: 'Valid schedule IDs were not provided' }, { status: 400 });
  }

  try {
    // 1. 先查詢所有 schedule 狀態和現有預約
    const schedules = await prisma.schedule.findMany({
      where: { id: { in: scheduleIds } },
      include: { bookings: true },
    });

    // 檢查時段是否已被預約（排除已取消的預約）
    const unavailableSchedules = schedules.filter(s => {
      // 如果時段本身不可用
      if (!s.isAvailable) return true;
      
      // 如果有預約記錄且狀態不是 CANCELLED 或 REJECTED，則時段不可用
      if (s.bookings && s.bookings.status !== 'CANCELLED' && s.bookings.status !== 'REJECTED') return true;
      
      return false;
    });
    
    if (unavailableSchedules.length > 0) {
      return NextResponse.json({
        error: `時段已被預約，請重新選擇。`,
        conflictIds: unavailableSchedules.map(s => s.id),
      }, { status: 409 });
    }

    if (schedules.length !== scheduleIds.length) {
      const foundIds = schedules.map(s => s.id);
      const notFoundIds = scheduleIds.filter(id => !foundIds.includes(id));
      return NextResponse.json({
        error: `部分時段不存在，請重新整理。`,
        notFoundIds,
      }, { status: 400 });
    }

    // 2. 進入 transaction 建立預約
    const result = await prisma.$transaction(async (tx) => {
      // 2-1. 建立預約
      const createdBookings = await Promise.all(
        scheduleIds.map(scheduleId => 
          tx.booking.create({
            data: {
              customerId: customer.id,
              scheduleId: scheduleId,
              status: 'PENDING' as any,
              originalAmount: 0, // 暫時設為 0，後續會更新
              finalAmount: 0,    // 暫時設為 0，後續會更新
            },
          })
        )
      );

      // 2-2. 標記時段為不可預約
      await tx.schedule.updateMany({
        where: {
          id: { in: scheduleIds },
        },
        data: {
          isAvailable: false,
        },
      });

      // 2-3. Discord 通知（僅單一時段）
      /*
      if (Array.isArray(scheduleIds) && scheduleIds.length === 1) {
        const schedule = await prisma.schedule.findUnique({
          where: { id: scheduleIds[0] },
          include: { partner: { select: { userId: true } } }
        });
        const user1 = await prisma.user.findUnique({ where: { id: customer.userId } });
        const user2 = schedule?.partner?.userId
          ? await prisma.user.findUnique({ where: { id: schedule.partner.userId } })
          : null;
        if (user1?.discord && user2?.discord && schedule?.startTime && schedule?.endTime) {
          const start = new Date(schedule.startTime).getTime();
          const end = new Date(schedule.endTime).getTime();
          const minutes = Math.round((end - start) / (1000 * 60));
          await fetch('http://localhost:5001/pair', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer 你的密鑰'
            },
            body: JSON.stringify({
              user1_id: encodeURIComponent(user1.discord),
              user2_id: encodeURIComponent(user2.discord),
              minutes
            })
          });
        }
      }
      */

      return createdBookings;
    });

    return NextResponse.json(result[0]); // 返回第一個預約的 ID
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during the booking process.';
    // Use 409 Conflict for booking clashes or other transaction failures.
    return NextResponse.json({ error: errorMessage }, { status: 409 }); 
  }
}

/**
 * Fetches bookings based on the user's role.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }

    // Role-based access control to filter bookings
    if (session.user.role === 'ADMIN') {
      // Admin can see all bookings, no additional filters needed here.
    } else if (session.user.role === 'PARTNER') {
      const partner = await prisma.partner.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!partner) {
        return NextResponse.json({ bookings: [] });
      }
      whereClause.schedule = { partnerId: partner.id };
    } else { // 'CUSTOMER'
      const customer = await prisma.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!customer) {
        return NextResponse.json({ bookings: [] });
      }
      whereClause.customerId = customer.id;
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        schedule: {
          include: {
            partner: {
              select: { name: true },
            },
          },
        },
        customer: {
          select: { name: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ bookings });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred' },
      { status: 500 }
    );
  }
} 