import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { BookingStatus } from '@prisma/client';
import { createChatRoomForBooking } from '@/lib/chat-helpers';

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

      const updatedBooking = await client.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CONFIRMED },
        include: {
          customer: { include: { user: true } },
          schedule: { include: { partner: { include: { user: true } } } },
        },
      });

      return { type: 'SUCCESS', booking: updatedBooking } as const;
    }, 'bookings:accept');

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 });
    }
    if (result.type === 'FORBIDDEN') {
      return NextResponse.json({ error: '沒有權限接受此預約' }, { status: 403 });
    }
    if (result.type === 'INVALID_STATUS') {
      return NextResponse.json({ error: '此預約無法接受' }, { status: 400 });
    }

    const booking = result.booking;

    // 自動創建聊天室（非阻塞）
    db.query(
      async (client) => {
        await createChatRoomForBooking(client, bookingId);
      },
      'chat:auto-create-on-accept'
    ).catch((error) => {
      console.error('❌ 自動創建聊天室失敗:', error);
    });

    // 發送 Email 確認通知給顧客（非阻塞）
    try {
      const durationMinutes = Math.round(
        (new Date(booking.schedule.endTime).getTime() - new Date(booking.schedule.startTime).getTime()) /
          (1000 * 60)
      );

      await sendBookingConfirmationEmail(
        booking.customer.user.email,
        booking.customer.user.name || '客戶',
        booking.schedule.partner.user.name || '夥伴',
        {
          duration: durationMinutes,
          startTime: booking.schedule.startTime.toISOString(),
          endTime: booking.schedule.endTime.toISOString(),
          totalCost: booking.finalAmount || 0,
          bookingId: booking.id,
        }
      );
    } catch (emailError) {
      console.error('❌ 發送預約確認通知失敗:', emailError);
    }

    // Discord 通知（若未設定服務則忽略錯誤）
    try {
      const customerDiscord = booking.customer.user.discord;
      const partnerDiscord = booking.schedule.partner.user.discord;

      if (customerDiscord && partnerDiscord) {
        const startTime = new Date(booking.schedule.startTime);
        const endTime = new Date(booking.schedule.endTime);
        const minutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

        await fetch('http://localhost:5001/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer 你的密鑰',
          },
          body: JSON.stringify({
            user1_id: customerDiscord,
            user2_id: partnerDiscord,
            minutes,
          }),
        });
      }
    } catch (discordError) {
      console.error('Discord notification failed:', discordError);
    }

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    return createErrorResponse(error, 'bookings:accept');
  }
} 