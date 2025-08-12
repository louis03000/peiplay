import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // 檢查用戶是否有權限取消此預約
    const isCustomer = booking.customer.userId === session.user.id;
    const isPartner = booking.schedule.partner.userId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isCustomer && !isPartner && !isAdmin) {
      return NextResponse.json({ error: '沒有權限取消此預約' }, { status: 403 });
    }

    // 檢查預約狀態
    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ error: '此預約已經被取消了' }, { status: 400 });
    }

    if (booking.status === 'COMPLETED') {
      return NextResponse.json({ error: '已完成的預約無法取消' }, { status: 400 });
    }

    if (booking.status === 'REJECTED') {
      return NextResponse.json({ error: '已拒絕的預約無法取消' }, { status: 400 });
    }

    // 檢查是否可以取消（例如：距離預約時間太近）
    const now = new Date();
    const bookingStartTime = new Date(booking.schedule.startTime);
    const hoursUntilBooking = (bookingStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // 如果距離預約時間少於 2 小時，不允許取消
    if (hoursUntilBooking < 2) {
      return NextResponse.json({ 
        error: '距離預約時間少於 2 小時，無法取消預約' 
      }, { status: 400 });
    }

    // 執行取消操作
    const result = await prisma.$transaction(async (tx) => {
      // 1. 更新預約狀態為已取消
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { 
          status: 'CANCELLED' as any,
          // 清除付款相關資訊
          orderNumber: null,
          paymentInfo: undefined,
          paymentError: null
        }
      });

      // 2. 將時段標記為可預約
      await tx.schedule.update({
        where: { id: booking.scheduleId },
        data: { isAvailable: true }
      });

      return updatedBooking;
    });

    // 發送 Discord 通知（如果有的話）
    try {
      const customerDiscord = booking.customer.user.discord;
      const partnerDiscord = booking.schedule.partner.user.discord;
      
      if (customerDiscord && partnerDiscord) {
        const startTime = new Date(booking.schedule.startTime);
        const endTime = new Date(booking.schedule.endTime);
        const minutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        
        // 發送取消通知
        await fetch('http://localhost:5001/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 你的密鑰'
          },
          body: JSON.stringify({
            user1_id: customerDiscord,
            user2_id: partnerDiscord,
            minutes,
            cancelled_by: isCustomer ? 'customer' : 'partner'
          })
        });
      }
    } catch (discordError) {
      console.error('Discord notification failed:', discordError);
      // Discord 通知失敗不影響取消操作
    }

    return NextResponse.json({ 
      success: true, 
      message: '預約已成功取消',
      booking: result 
    });

  } catch (error) {
    console.error('取消預約時發生錯誤:', error);
    return NextResponse.json(
      { error: '取消預約失敗，請稍後再試' },
      { status: 500 }
    );
  }
} 