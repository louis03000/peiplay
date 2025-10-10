import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sendBookingConfirmationEmail } from '@/lib/email';
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
    // 只有夥伴本人或管理員可接受
    const isPartner = booking.schedule.partner.userId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';
    if (!isPartner && !isAdmin) {
      return NextResponse.json({ error: '沒有權限接受此預約' }, { status: 403 });
    }
    if (booking.status !== 'PENDING' && booking.status !== 'PAID_WAITING_PARTNER_CONFIRMATION') {
      return NextResponse.json({ error: '此預約無法接受' }, { status: 400 });
    }
    // 更新狀態為 CONFIRMED
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' as any },
      include: {
        customer: {
          include: {
            user: true
          }
        },
        schedule: {
          include: {
            partner: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });
    
    // 發送 Email 確認通知給顧客
    try {
      const duration = Math.round((new Date(updatedBooking.schedule.endTime).getTime() - new Date(updatedBooking.schedule.startTime).getTime()) / (1000 * 60));
      
      await sendBookingConfirmationEmail(
        updatedBooking.customer.user.email,
        updatedBooking.customer.user.name || '客戶',
        updatedBooking.schedule.partner.user.name || '夥伴',
        {
          duration: duration,
          startTime: updatedBooking.schedule.startTime.toISOString(),
          endTime: updatedBooking.schedule.endTime.toISOString(),
          totalCost: updatedBooking.finalAmount || 0,
          bookingId: updatedBooking.id
        }
      );
      console.log('✅ 預約確認通知 email 已發送給顧客');
    } catch (emailError) {
      console.error('❌ 發送預約確認通知失敗:', emailError);
    }
    
    // 發送 Discord 通知給顧客
    try {
      const customerDiscord = booking.customer.user.discord;
      const partnerDiscord = booking.schedule.partner.user.discord;
      
      if (customerDiscord && partnerDiscord) {
        const startTime = new Date(booking.schedule.startTime);
        const endTime = new Date(booking.schedule.endTime);
        const minutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        
        // 發送接受通知
        await fetch('http://localhost:5001/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 你的密鑰'
          },
          body: JSON.stringify({
            user1_id: customerDiscord,
            user2_id: partnerDiscord,
            minutes
          })
        });
      }
    } catch (discordError) {
      console.error('Discord notification failed:', discordError);
      // Discord 通知失敗不影響接受操作
    }
    
    return NextResponse.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error('接受預約時發生錯誤:', error);
    return NextResponse.json({ error: '接受預約失敗，請稍後再試' }, { status: 500 });
  }
} 