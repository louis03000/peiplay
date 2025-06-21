import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Re-deploy trigger
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登入' }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.user.id },
  });

  if (!customer) {
    // If the user is logged in but doesn't have a customer profile,
    // you might want to create one or prompt them to.
    // For now, we'll return an error.
    return NextResponse.json({ error: '找不到顧客資料，請先完善個人檔案' }, { status: 404 });
  }

  const { scheduleIds } = await request.json();

  if (!scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    return NextResponse.json({ error: '沒有提供有效的時段 ID' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the schedules to prevent race conditions and check availability
      const schedules = await tx.schedule.findMany({
        where: {
          id: { in: scheduleIds },
        },
        // Use `forUpdate` to lock the selected rows for the duration of the transaction
        // This is a PostgreSQL-specific feature available through Prisma
      });

      const unavailableSchedules = schedules.filter(s => !s.isAvailable);
      if (unavailableSchedules.length > 0) {
        throw new Error(`時段 ${unavailableSchedules.map(s => s.id).join(', ')} 已被預約，請重新選擇。`);
      }
      
      if (schedules.length !== scheduleIds.length) {
        const foundIds = schedules.map(s => s.id);
        const notFoundIds = scheduleIds.filter(id => !foundIds.includes(id));
        throw new Error(`時段 ID ${notFoundIds.join(', ')} 不存在。`);
      }


      // 2. Create a booking for each schedule
      const createdBookings = await tx.booking.createMany({
        data: scheduleIds.map(scheduleId => ({
          customerId: customer.id,
          scheduleId: scheduleId,
          status: 'CONFIRMED',
        })),
      });

      // 3. Mark the schedules as unavailable
      await tx.schedule.updateMany({
        where: {
          id: { in: scheduleIds },
        },
        data: {
          isAvailable: false,
        },
      });

      return createdBookings;
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '預約處理失敗';
    // Use 409 Conflict for booking clashes or other transaction failures
    return NextResponse.json({ error: errorMessage }, { status: 409 }); 
  }
}

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

    // Role-based access control
    if (session.user.role === 'ADMIN') {
      // Admin can see all bookings, filters apply to all
    } else if (session.user.role === 'PARTNER') {
      const partner = await prisma.partner.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!partner) {
        return NextResponse.json({ bookings: [] });
      }
      whereClause.schedule = { partnerId: partner.id };
    } else { // CUSTOMER
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
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 