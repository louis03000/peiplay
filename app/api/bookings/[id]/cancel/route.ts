import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { BookingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    if (!bookingId) {
      return NextResponse.json({ error: '預約 ID 是必需的' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!customer) {
        return { type: 'NO_CUSTOMER' } as const;
      }

      const booking = await client.booking.findUnique({
        where: { id: bookingId },
        include: { schedule: true },
      });

      if (!booking) {
        return { type: 'NOT_FOUND' } as const;
      }

      if (booking.customerId !== customer.id) {
        return { type: 'FORBIDDEN' } as const;
      }

      if (booking.status === BookingStatus.CANCELLED) {
        return { type: 'ALREADY_CANCELLED', booking } as const;
      }

      const updatedBooking = await client.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
        include: {
          schedule: {
            include: {
              partner: {
                select: { name: true },
              },
            },
          },
        },
      });

      return { type: 'SUCCESS', booking: updatedBooking } as const;
    }, 'bookings:cancel');

    if (result.type === 'NO_CUSTOMER') {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }
    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 });
    }
    if (result.type === 'FORBIDDEN') {
      return NextResponse.json({ error: '沒有權限取消此預約' }, { status: 403 });
    }
    if (result.type === 'ALREADY_CANCELLED') {
      return NextResponse.json({
        success: true,
        message: '預約已經被取消',
        booking: result.booking,
      });
    }

    return NextResponse.json({
      success: true,
      message: '預約已成功取消',
      booking: result.booking,
    });
  } catch (error) {
    return createErrorResponse(error, 'bookings:cancel');
  }
} 