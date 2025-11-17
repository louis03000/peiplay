import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { sendBookingConfirmationEmail, sendBookingRejectionEmail } from '@/lib/email';
import { createChatRoomForBooking } from '@/lib/chat-helpers';
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
      const isMultiPlayerBooking = booking.isMultiPlayerBooking === true || booking.multiPlayerBookingId !== null;
      
      if (isGroupBooking) {
        return { type: 'GROUP' } as const;
      }

      if (booking.status !== BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION) {
        return { type: 'INVALID_STATUS' } as const;
      }

      const newStatus = action === 'accept' ? BookingStatus.CONFIRMED : BookingStatus.REJECTED;

      // 如果是多人陪玩，需要更新群組狀態
      let multiPlayerBookingUpdate = null;
      if (isMultiPlayerBooking && booking.multiPlayerBookingId) {
        const multiPlayerBooking = await client.multiPlayerBooking.findUnique({
          where: { id: booking.multiPlayerBookingId },
          include: {
            bookings: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        });

        if (multiPlayerBooking) {
          // 檢查是否有至少一個夥伴已確認
          const hasConfirmedPartner = multiPlayerBooking.bookings.some(
            b => b.id !== booking.id && (b.status === 'CONFIRMED' || b.status === 'PARTNER_ACCEPTED')
          );

          // 如果接受且群組狀態是 PENDING，更新為 ACTIVE
          if (action === 'accept' && multiPlayerBooking.status === 'PENDING') {
            multiPlayerBookingUpdate = { status: 'ACTIVE' };
          }
        }
      }

      // 先更新状态，只选择必要的字段
      const updated = await client.booking.update({
        where: { id: booking.id },
        data: {
          status: newStatus,
          ...(action === 'reject' && reason ? { rejectReason: reason.trim() } : {}),
        },
        select: {
          id: true,
          status: true,
          finalAmount: true,
          schedule: {
            select: {
              startTime: true,
              endTime: true,
              partner: {
                select: {
                  user: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          customer: {
            select: {
              user: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // 更新多人陪玩群組狀態（如果需要）
      if (multiPlayerBookingUpdate && booking.multiPlayerBookingId) {
        await client.multiPlayerBooking.update({
          where: { id: booking.multiPlayerBookingId },
          data: multiPlayerBookingUpdate,
        }).catch((error) => {
          console.error('❌ 更新多人陪玩群組狀態失敗:', error);
        });
      }

      return { type: 'SUCCESS', booking: updated, action, originalBooking: booking, isMultiPlayerBooking } as const;
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
    
    // 多人陪玩允許確認，不需要特殊處理
    if (result.type === 'INVALID_STATUS') {
      return NextResponse.json({ error: '預約狀態不正確' }, { status: 400 });
    }

    // 立即返回响应，后台处理耗时操作
    const responseData = {
      success: true,
      message: `預約已${result.action === 'accept' ? '接受' : '拒絕'}`,
      booking: {
        id: result.booking.id,
        status: result.booking.status,
      },
    };

    // 后台处理耗时操作（不阻塞响应）
    Promise.all([
      // 如果接受預約，自動創建聊天室
      result.action === 'accept'
        ? db.query(
            async (client) => {
              await createChatRoomForBooking(client, resolvedParams.id);
            },
            'chat:auto-create-on-respond'
          ).catch((error) => {
            console.error('❌ 自動創建聊天室失敗:', error);
          })
        : Promise.resolve(),
      
      // 发送邮件（使用原始 booking 数据，因为更新后的只包含部分字段）
      (async () => {
        const originalBooking = result.originalBooking;
        if (!originalBooking) return;

        const duration =
          (originalBooking.schedule.endTime.getTime() - originalBooking.schedule.startTime.getTime()) /
          (1000 * 60 * 60);

        if (result.action === 'accept') {
          await sendBookingConfirmationEmail(
            originalBooking.customer.user.email,
            originalBooking.customer.user.name || '客戶',
            originalBooking.schedule.partner.user.name || '夥伴',
            {
              duration,
              startTime: originalBooking.schedule.startTime.toISOString(),
              endTime: originalBooking.schedule.endTime.toISOString(),
              totalCost: result.booking.finalAmount || 0,
              bookingId: result.booking.id,
            }
          ).catch((error) => {
            console.error('❌ Email 發送失敗:', error);
          });
        } else {
          await sendBookingRejectionEmail(
            originalBooking.customer.user.email,
            originalBooking.customer.user.name || '客戶',
            originalBooking.schedule.partner.user.name || '夥伴',
            {
              startTime: originalBooking.schedule.startTime.toISOString(),
              endTime: originalBooking.schedule.endTime.toISOString(),
              bookingId: result.booking.id,
            }
          ).catch((error) => {
            console.error('❌ Email 發送失敗:', error);
          });
        }
      })(),
    ]).catch((error) => {
      console.error('❌ 後台處理失敗:', error);
    });

    return NextResponse.json(responseData);
  } catch (error) {
    return createErrorResponse(error, 'bookings:respond');
  }
}
