import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendBookingConfirmationEmail, sendBookingRejectionEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 夥伴接受或拒絕預約
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("✅ booking response POST api triggered");
    
    const { id } = await params;
    const { action } = await request.json(); // 'accept' 或 'reject'

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: '無效的操作' }, { status: 400 });
    }

    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 確保資料庫連線
    await prisma.$connect();

    // 查找夥伴資料
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    });

    if (!partner) {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
    }

    // 查找預約記錄
    const booking = await prisma.booking.findUnique({
      where: { id },
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

    if (!booking) {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 });
    }

    // 檢查是否為該夥伴的預約
    if (booking.schedule.partnerId !== partner.id) {
      return NextResponse.json({ error: '無權限操作此預約' }, { status: 403 });
    }

    // 檢查預約狀態
    if (booking.status !== 'PENDING_PARTNER_CONFIRMATION') {
      return NextResponse.json({ error: '預約狀態不正確' }, { status: 400 });
    }

    // 更新預約狀態
    const newStatus = action === 'accept' ? 'CONFIRMED' : 'REJECTED';
    
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: newStatus },
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

    // 發送 email 通知給客戶
    try {
      const duration = (booking.schedule.endTime.getTime() - booking.schedule.startTime.getTime()) / (1000 * 60 * 60);
      
      if (action === 'accept') {
        await sendBookingConfirmationEmail(
          booking.customer.user.email,
          booking.customer.user.name || '客戶',
          booking.schedule.partner.user.name || '夥伴',
          {
            duration: duration,
            startTime: booking.schedule.startTime.toISOString(),
            endTime: booking.schedule.endTime.toISOString(),
            totalCost: booking.finalAmount,
            bookingId: booking.id
          }
        );
      } else {
        await sendBookingRejectionEmail(
          booking.customer.user.email,
          booking.customer.user.name || '客戶',
          booking.schedule.partner.user.name || '夥伴',
          {
            startTime: booking.schedule.startTime.toISOString(),
            endTime: booking.schedule.endTime.toISOString(),
            bookingId: booking.id
          }
        );
      }
      
      console.log(`✅ Email 通知已發送給客戶: ${booking.customer.user.email}`);
    } catch (emailError) {
      console.error('❌ Email 發送失敗:', emailError);
      // 不影響預約狀態更新，只記錄錯誤
    }

    console.log(`✅ 預約 ${action === 'accept' ? '接受' : '拒絕'} 成功:`, booking.id);

    return NextResponse.json({
      success: true,
      message: `預約已${action === 'accept' ? '接受' : '拒絕'}`,
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status
      }
    });

  } catch (error) {
    console.error('❌ 預約回應失敗:', error);
    return NextResponse.json({ 
      error: '預約回應失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}
