import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
    // 取得拒絕原因
    const { reason } = await request.json();
    if (!reason || reason.trim() === '') {
      return NextResponse.json({ error: '拒絕原因是必需的' }, { status: 400 });
    }
    // 查找預約並檢查權限
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { include: { user: true } },
        schedule: { include: { partner: { include: { user: true } } } }
      }
    });
    if (!booking) {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 });
    }
    // 只有夥伴本人或管理員可拒絕
    const isPartner = booking.schedule.partner.userId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';
    if (!isPartner && !isAdmin) {
      return NextResponse.json({ error: '沒有權限拒絕此預約' }, { status: 403 });
    }
    if (booking.status !== 'PENDING') {
      return NextResponse.json({ error: '此預約無法拒絕' }, { status: 400 });
    }
    // 更新狀態為 REJECTED，並釋放時段
    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'REJECTED' as any, rejectReason: reason }
      });
      await tx.schedule.update({
        where: { id: booking.scheduleId },
        data: { isAvailable: true }
      });
      return updatedBooking;
    });
    // 發送 Discord 通知給顧客
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
            'Authorization': 'Bearer 你的密鑰'
          },
          body: JSON.stringify({
            user1_id: customerDiscord,
            user2_id: partnerDiscord,
            minutes,
            reason: reason,
            rejected_by: 'partner'
          })
        });
      }
    } catch (discordError) {
      console.error('Discord notification failed:', discordError);
    }
    return NextResponse.json({ 
      success: true, 
      booking: result,
      reason: reason 
    });
  } catch (error: any) {
    console.error('拒絕預約時發生錯誤:', error);
    return NextResponse.json({ error: error?.message ? String(error.message) : String(error) }, { status: 500 });
  }
} 