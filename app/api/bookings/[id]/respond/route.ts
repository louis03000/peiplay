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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    console.log("✅ booking respond POST api triggered");
    
    // 處理 params（可能是 Promise）
    const resolvedParams = params instanceof Promise ? await params : params;
    const { action, reason } = await request.json(); // 'accept' 或 'reject'

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: '無效的操作' }, { status: 400 });
    }

    // 如果是拒絕操作，必須提供拒絕原因
    if (action === 'reject' && (!reason || reason.trim() === '')) {
      return NextResponse.json({ error: '拒絕預約時必須提供拒絕原因' }, { status: 400 });
    }

    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 查找夥伴資料
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    });

    if (!partner) {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
    }

    // 查找預約記錄
    const booking = await prisma.booking.findUnique({
      where: { id: resolvedParams.id },
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

    // 檢查預約狀態 - 群組預約不需要確認
    const isGroupBooking = booking.isGroupBooking === true || booking.groupBookingId !== null;
    
    if (isGroupBooking) {
      console.log('⚠️ 這是群組預約，不需要夥伴確認');
      return NextResponse.json({ error: '群組預約不需要確認' }, { status: 400 });
    }

    // 檢查預約狀態
    if (booking.status !== 'PAID_WAITING_PARTNER_CONFIRMATION') {
      return NextResponse.json({ error: '預約狀態不正確' }, { status: 400 });
    }

    // 更新預約狀態
    const newStatus = action === 'accept' ? 'CONFIRMED' : 'REJECTED';
    
    const updatedBooking = await prisma.booking.update({
      where: { id: resolvedParams.id },
      data: { 
        status: newStatus,
        ...(action === 'reject' && reason ? { rejectReason: reason.trim() } : {})
      },
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

    // 發送 email 通知給客戶（非阻塞方式，立即返回響應）
    const duration = (booking.schedule.endTime.getTime() - booking.schedule.startTime.getTime()) / (1000 * 60 * 60);
    
    if (action === 'accept') {
      sendBookingConfirmationEmail(
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
      ).then(() => {
        console.log(`✅ Email 通知已發送給客戶: ${booking.customer.user.email}`);
      }).catch((emailError) => {
        console.error('❌ Email 發送失敗:', emailError);
      });
    } else {
      sendBookingRejectionEmail(
        booking.customer.user.email,
        booking.customer.user.name || '客戶',
        booking.schedule.partner.user.name || '夥伴',
        {
          startTime: booking.schedule.startTime.toISOString(),
          endTime: booking.schedule.endTime.toISOString(),
          bookingId: booking.id
        }
      ).then(() => {
        console.log(`✅ Email 通知已發送給客戶: ${booking.customer.user.email}`);
      }).catch((emailError) => {
        console.error('❌ Email 發送失敗:', emailError);
      });
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
  }
}
