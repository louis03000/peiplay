import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { sendBookingConfirmationEmail, sendBookingRejectionEmail, sendWarningEmail, sendMultiPlayerPartnerRejectionEmail, sendMultiPlayerBookingCancelledEmail } from '@/lib/email';
import { createChatRoomForBooking } from '@/lib/chat-helpers';
import { BookingStatus, MultiPlayerBookingStatus } from '@prisma/client';

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
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          schedule: {
            include: {
              partner: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
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

      // 🔥 如果是多人陪玩，需要特殊處理
      let multiPlayerBookingData = null;
      if (isMultiPlayerBooking && booking.multiPlayerBookingId) {
        const multiPlayerBooking = await client.multiPlayerBooking.findUnique({
          where: { id: booking.multiPlayerBookingId },
          include: {
            bookings: {
              include: {
                schedule: {
                  include: {
                    partner: {
                      include: {
                        user: {
                          select: {
                            name: true,
                            email: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            customer: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        });

        if (multiPlayerBooking) {
          const totalBookings = multiPlayerBooking.bookings.length;
          const confirmedBookings = multiPlayerBooking.bookings.filter(
            b => b.status === 'CONFIRMED' || b.status === 'PARTNER_ACCEPTED'
          );
          const rejectedBookings = multiPlayerBooking.bookings.filter(
            b => b.status === 'REJECTED' || b.status === 'PARTNER_REJECTED'
          );
          
          // 如果接受，檢查是否所有夥伴都同意了
          if (action === 'accept') {
            // 計算接受後的確認數量
            const willBeConfirmed = confirmedBookings.length + (booking.status === 'PAID_WAITING_PARTNER_CONFIRMATION' ? 1 : 0);
            
            // 如果所有夥伴都確認了，更新狀態為 ACTIVE
            if (willBeConfirmed === totalBookings && multiPlayerBooking.status === 'PENDING') {
              await client.multiPlayerBooking.update({
                where: { id: booking.multiPlayerBookingId },
                data: { status: MultiPlayerBookingStatus.ACTIVE },
              });
            }
          }
          
          // 如果拒絕，記錄多人陪玩數據以便後續處理
          if (action === 'reject') {
            multiPlayerBookingData = {
              multiPlayerBooking,
              totalBookings,
              confirmedCount: confirmedBookings.length,
              rejectedCount: rejectedBookings.length + 1, // 加上當前拒絕的
            };
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

      return { 
        type: 'SUCCESS', 
        booking: updated, 
        action, 
        originalBooking: booking, 
        isMultiPlayerBooking,
        multiPlayerBookingData // 🔥 傳遞多人陪玩數據
      } as const;
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
          // 🔥 多人陪玩拒絕的特殊處理
          if (result.isMultiPlayerBooking && result.multiPlayerBookingData) {
            const { multiPlayerBooking, totalBookings, confirmedCount, rejectedCount } = result.multiPlayerBookingData;
            
            // 發送 email 通知顧客
            await sendMultiPlayerPartnerRejectionEmail(
              originalBooking.customer.user.email,
              originalBooking.customer.user.name || '客戶',
              originalBooking.schedule.partner.user.name || '夥伴',
              multiPlayerBooking.id,
              {
                startTime: originalBooking.schedule.startTime.toISOString(),
                endTime: originalBooking.schedule.endTime.toISOString(),
                totalPartners: totalBookings,
                confirmedPartners: confirmedCount,
              }
            ).catch((error) => {
              console.error('❌ 多人陪玩拒絕 Email 發送失敗:', error);
            });
          } else {
            // 一般預約拒絕
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
        }
      })(),

      // 夥伴拒絕次數檢查（1 週內 3 次拒絕 → 站內通知 + 警告信）
      (async () => {
        if (result.action !== 'reject') return;
        const originalBooking = result.originalBooking;
        if (!originalBooking) return;

        const partnerId = originalBooking.schedule.partnerId;
        const partnerUserEmail = originalBooking.schedule.partner.user.email;
        const partnerUserName = originalBooking.schedule.partner.user.name || '夥伴';

        if (!partnerId) return;

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const rejectionCount = await db.query(async (client) => {
          return client.booking.count({
            where: {
              status: BookingStatus.REJECTED,
              updatedAt: { gte: oneWeekAgo },
              schedule: { partnerId },
            },
          });
        }, 'bookings:respond:rejection-count');

        if (rejectionCount >= 3) {
          // 查詢所有管理員
          const admins = await db.query(async (client) => {
            return client.user.findMany({
              where: { role: 'ADMIN' },
              select: { id: true },
            });
          }, 'bookings:respond:find-admins');

          // 建立站內通知（夥伴本人 + 管理員）
          await db.query(async (client) => {
            // 夥伴本人
            await client.personalNotification.create({
              data: {
                userId: partnerId,
                senderId: partnerId,
                title: '頻繁拒絕預約警告',
                content: `您在 7 天內已拒絕 ${rejectionCount} 次預約，請留意後續使用規範。`,
                type: 'WARNING',
                priority: 'HIGH',
              },
            });

            // 管理員
            for (const admin of admins) {
              await client.personalNotification.create({
                data: {
                  userId: admin.id,
                  senderId: partnerId,
                  title: '夥伴頻繁拒絕預約警告',
                  content: `夥伴 ${partnerUserName} 在 7 天內拒絕 ${rejectionCount} 次預約，請留意。`,
                  type: 'WARNING',
                  priority: 'HIGH',
                },
              });
            }
          }, 'bookings:respond:notify-admins');

          // 警告信（若有 email）
          if (partnerUserEmail) {
            await sendWarningEmail(partnerUserEmail, partnerUserName, {
              rejectionCount: rejectionCount,
              warningType: 'FREQUENT_REJECTIONS',
            }).catch((error) => {
              console.error('❌ 警告郵件發送失敗:', error);
            });
          }
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
