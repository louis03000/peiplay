import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { sendBookingConfirmationEmail, sendBookingRejectionEmail } from '@/lib/email';
import { BookingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 夥伴接受或拒絕預約
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { action, reason } = await request.json();

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: '無效的操作' }, { status: 400 });
    }

    if (action === 'reject' && (!reason || reason.trim() === '')) {
      return NextResponse.json({ error: '拒絕預約時必須提供拒絕原因' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!partner) {
        return { type: 'NO_PARTNER' } as const;
      }

      const booking = await client.booking.findUnique({
        where: { id: resolvedParams.id },
        include: {
          customer: {
            include: {
              user: true,
            },
          },
          schedule: {
            include: {
              partner: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (!booking) {
        return { type: 'NOT_FOUND' } as const;
      }

      if (booking.schedule.partnerId !== partner.id) {
        return { type: 'FORBIDDEN' } as const;
      }

      const isGroupBooking = booking.isGroupBooking === true || booking.groupBookingId !== null;
      if (isGroupBooking) {
        return { type: 'GROUP' } as const;
      }

      if (booking.status !== BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION) {
        return { type: 'INVALID_STATUS' } as const;
      }

      const newStatus = action === 'accept' ? BookingStatus.CONFIRMED : BookingStatus.REJECTED;

      const updated = await client.booking.update({
        where: { id: booking.id },
        data: {
          status: newStatus,
          ...(action === 'reject' && reason ? { rejectReason: reason.trim() } : {}),
        },
        include: {
          customer: {
            include: {
              user: true,
            },
          },
          schedule: {
            include: {
              partner: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      return { type: 'SUCCESS', booking: updated, action } as const;
    }, 'bookings:respond');

    if (result.type === 'NO_PARTNER') {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
    }
    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 });
    }
    if (result.type === 'FORBIDDEN') {
      return NextResponse.json({ error: '無權限操作此預約' }, { status: 403 });
    }
    if (result.type === 'GROUP') {
      return NextResponse.json({ error: '群組預約不需要確認' }, { status: 400 });
    }
    if (result.type === 'INVALID_STATUS') {
      return NextResponse.json({ error: '預約狀態不正確' }, { status: 400 });
    }

    const duration =
      (result.booking.schedule.endTime.getTime() - result.booking.schedule.startTime.getTime()) /
      (1000 * 60 * 60);

    if (result.action === 'accept') {
      sendBookingConfirmationEmail(
        result.booking.customer.user.email,
        result.booking.customer.user.name || '客戶',
        result.booking.schedule.partner.user.name || '夥伴',
        {
          duration,
          startTime: result.booking.schedule.startTime.toISOString(),
          endTime: result.booking.schedule.endTime.toISOString(),
          totalCost: result.booking.finalAmount,
          bookingId: result.booking.id,
        }
      ).catch((error) => {
        console.error('❌ Email 發送失敗:', error);
      });
    } else {
      sendBookingRejectionEmail(
        result.booking.customer.user.email,
        result.booking.customer.user.name || '客戶',
        result.booking.schedule.partner.user.name || '夥伴',
        {
          startTime: result.booking.schedule.startTime.toISOString(),
          endTime: result.booking.schedule.endTime.toISOString(),
          bookingId: result.booking.id,
        }
      ).catch((error) => {
        console.error('❌ Email 發送失敗:', error);
      });
    }

    return NextResponse.json({
      success: true,
      message: `預約已${result.action === 'accept' ? '接受' : '拒絕'}`,
      booking: {
        id: result.booking.id,
        status: result.booking.status,
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'bookings:respond');
  }
}
