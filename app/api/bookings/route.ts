import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the schedules to prevent race conditions and check availability.
      // Note: `forUpdate` is a Prisma preview feature for PostgreSQL.
      const schedules = await tx.schedule.findMany({
        where: {
          id: { in: scheduleIds },
        },
      });

      const unavailableSchedules = schedules.filter(s => !s.isAvailable);
      if (unavailableSchedules.length > 0) {
        throw new Error(`Time slots ${unavailableSchedules.map(s => s.id).join(', ')} are already booked. Please refresh and try again.`);
      }
      
      if (schedules.length !== scheduleIds.length) {
        const foundIds = schedules.map(s => s.id);
        const notFoundIds = scheduleIds.filter(id => !foundIds.includes(id));
        throw new Error(`Schedule IDs not found: ${notFoundIds.join(', ')}.`);
      }

      // 2. Create bookings for each selected time slot.
      const createdBookings = await tx.booking.createMany({
        data: scheduleIds.map(scheduleId => ({
          customerId: customer.id,
          scheduleId: scheduleId,
          status: 'CONFIRMED',
        })),
      });

      // 3. Mark the schedules as unavailable.
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