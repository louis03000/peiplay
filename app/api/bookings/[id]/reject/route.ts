import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { BookingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const bookingId = params.id;
    if (!bookingId) {
      return NextResponse.json({ error: '預約 ID 是必需的' }, { status: 400 });
    }

    const { reason } = await request.json();
    if (!reason || reason.trim() === '') {
      return NextResponse.json({ error: '拒絕原因是必需的' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      const booking = await client.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: { include: { user: true } },
          schedule: { include: { partner: { include: { user: true } } } },
        },
      });

      if (!booking) {
        return { type: 'NOT_FOUND' } as const;
      }

      const isPartner = booking.schedule.partner.userId === session.user.id;
      const isAdmin = session.user.role === 'ADMIN';

      if (!isPartner && !isAdmin) {
        return { type: 'FORBIDDEN' } as const;
      }

      if (
        booking.status !== BookingStatus.PENDING &&
        booking.status !== BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION
      ) {
        return { type: 'INVALID_STATUS' } as const;
      }

      const updated = await client.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.REJECTED,
            rejectReason: reason,
          },
          include: {
            customer: { include: { user: true } },
            schedule: { include: { partner: { include: { user: true } } } },
          },
        });

        await tx.schedule.update({
          where: { id: booking.scheduleId },
          data: { isAvailable: true },
        });

        return updatedBooking;
      });

      return { type: 'SUCCESS', booking: updated } as const;
    }, 'bookings:reject');

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 });
    }
    if (result.type === 'FORBIDDEN') {
      return NextResponse.json({ error: '沒有權限拒絕此預約' }, { status: 403 });
    }
    if (result.type === 'INVALID_STATUS') {
      return NextResponse.json({ error: '此預約無法拒絕' }, { status: 400 });
    }

    const booking = result.booking;

    try {
      const customerDiscord = booking.customer.user.discord;
      const partnerDiscord = booking.schedule.partner.user.discord;
      if (customerDiscord && partnerDiscord) {
        const startTime = new Date(booking.schedule.startTime);
        const endTime = new Date(booking.schedule.endTime);
        const minutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

        await fetch('http://localhost:5001/reject', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer 你的密鑰',
          },
          body: JSON.stringify({
            user1_id: customerDiscord,
            user2_id: partnerDiscord,
            minutes,
            reason,
            rejected_by: 'partner',
          }),
        });
      }
    } catch (discordError) {
      console.error('Discord notification failed:', discordError);
    }

    return NextResponse.json({ success: true, booking, reason });
  } catch (error) {
    return createErrorResponse(error, 'bookings:reject');
  }
} 