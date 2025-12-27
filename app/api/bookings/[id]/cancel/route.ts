import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { BookingStatus } from '@prisma/client';
import { sendWarningEmail, sendMultiPlayerBookingCancelledEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const body = await request.json();
    const { reason } = body;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    if (!bookingId) {
      return NextResponse.json({ error: '預約 ID 是必需的' }, { status: 400 });
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: '請提供取消理由' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!customer) {
        return { type: 'NO_CUSTOMER' } as const;
      }

      const booking = await client.booking.findUnique({
        where: { id: bookingId },
        include: { 
          schedule: true,
          multiPlayerBooking: {
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
          },
        },
      });

      if (!booking) {
        return { type: 'NOT_FOUND' } as const;
      }

      if (booking.customerId !== customer.id) {
        return { type: 'FORBIDDEN' } as const;
      }

      if (booking.status === BookingStatus.CANCELLED) {
        return { type: 'ALREADY_CANCELLED', booking } as const;
      }

      const isMultiPlayerBooking = booking.multiPlayerBookingId !== null;
      let multiPlayerBookingData = null;
      let rejectedPartnerName = null;

      // 🔥 如果是多人陪玩，需要取消整個群組並通知已同意的夥伴
      if (isMultiPlayerBooking && booking.multiPlayerBooking) {
        const multiPlayerBooking = booking.multiPlayerBooking;
        
        // 找出拒絕的夥伴名稱（用於 email 通知）
        const rejectedBooking = multiPlayerBooking.bookings.find(
          b => b.status === 'REJECTED' || b.status === 'PARTNER_REJECTED'
        );
        if (rejectedBooking) {
          rejectedPartnerName = rejectedBooking.schedule.partner.user.name || '夥伴';
        }

        // 取消所有相關的 Booking
        await client.booking.updateMany({
          where: {
            multiPlayerBookingId: multiPlayerBooking.id,
            status: {
              notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED, BookingStatus.PARTNER_REJECTED],
            },
          },
          data: {
            status: BookingStatus.CANCELLED,
          },
        });

        // 更新 MultiPlayerBooking 狀態為 CANCELLED
        await client.multiPlayerBooking.update({
          where: { id: multiPlayerBooking.id },
          data: { status: 'CANCELLED' },
        });

        // 記錄所有取消的 Booking
        for (const b of multiPlayerBooking.bookings) {
          if (b.status !== BookingStatus.CANCELLED && 
              b.status !== BookingStatus.REJECTED && 
              b.status !== BookingStatus.PARTNER_REJECTED) {
            await client.bookingCancellation.create({
              data: {
                bookingId: b.id,
                customerId: customer.id,
                reason: reason.trim(),
              },
            });
          }
        }

        // 找出已同意的夥伴（需要發送 email）
        const confirmedPartners = multiPlayerBooking.bookings.filter(
          b => (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.PARTNER_ACCEPTED) &&
               b.id !== bookingId
        );

        multiPlayerBookingData = {
          multiPlayerBooking,
          confirmedPartners,
          rejectedPartnerName: rejectedPartnerName || '某位夥伴',
        };
      } else {
        // 一般預約：只取消當前預約
        await client.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.CANCELLED },
        });

        // 記錄取消記錄
        await client.bookingCancellation.create({
          data: {
            bookingId: bookingId,
            customerId: customer.id,
            reason: reason.trim(),
          },
        });
      }

      // 獲取更新後的預約信息
      const updatedBooking = await client.booking.findUnique({
        where: { id: bookingId },
        include: {
          schedule: {
            include: {
              partner: {
                select: { name: true },
              },
            },
          },
        },
      });

      // 獲取用戶信息（用於後續通知）
      const customerWithUser = await client.customer.findUnique({
        where: { id: customer.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return { 
        type: 'SUCCESS', 
        booking: updatedBooking,
        customerId: customer.id,
        customerWithUser,
        isMultiPlayerBooking,
        multiPlayerBookingData,
      } as const;
    }, 'bookings:cancel');

    if (result.type === 'NO_CUSTOMER') {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }
    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 });
    }
    if (result.type === 'FORBIDDEN') {
      return NextResponse.json({ error: '沒有權限取消此預約' }, { status: 403 });
    }
    if (result.type === 'ALREADY_CANCELLED') {
      return NextResponse.json({
        success: true,
        message: '預約已經被取消',
        booking: result.booking,
      });
    }

    // 🔥 如果是多人陪玩取消，發送 email 給已同意的夥伴
    if (result.type === 'SUCCESS' && result.isMultiPlayerBooking && result.multiPlayerBookingData) {
      const { multiPlayerBooking, confirmedPartners, rejectedPartnerName } = result.multiPlayerBookingData;
      
      // 異步發送 email 給所有已同意的夥伴
      Promise.all(
        confirmedPartners.map(async (partnerBooking) => {
          try {
            await sendMultiPlayerBookingCancelledEmail(
              partnerBooking.schedule.partner.user.email || '',
              partnerBooking.schedule.partner.user.name || '夥伴',
              result.customerWithUser?.user.name || '顧客',
              rejectedPartnerName,
              {
                startTime: multiPlayerBooking.startTime.toISOString(),
                endTime: multiPlayerBooking.endTime.toISOString(),
                bookingId: multiPlayerBooking.id,
              }
            );
          } catch (error) {
            console.error(`❌ 發送取消通知給夥伴失敗:`, error);
          }
        })
      ).catch((error) => {
        console.error('❌ 發送多人陪玩取消通知失敗:', error);
      });
    }

    // 在事務外檢查是否需要通知管理員（避免阻塞取消流程）
    if (result.type === 'SUCCESS' && result.customerId && result.customerWithUser) {
      // 異步檢查一個禮拜內是否有三次取消記錄（不阻塞響應）
      Promise.resolve().then(async () => {
        try {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          
          const recentCancellations = await db.query(async (client) => {
            return await client.bookingCancellation.findMany({
              where: {
                customerId: result.customerId,
                createdAt: {
                  gte: oneWeekAgo,
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            });
          }, 'bookings:cancel:check-frequency');

          // 如果一個禮拜內有三次或以上取消，通知（站內 + Email）
          if (recentCancellations.length >= 3 && result.customerWithUser?.user) {
            const userId = result.customerWithUser.user.id;
            const userEmail = result.customerWithUser.user.email;
            const userName = result.customerWithUser.user.name ?? '用戶';

            // 如果沒有 email，就不發送警告郵件，但仍可通知管理員
            const canSendEmail = !!userEmail && typeof userEmail === 'string';

            // 查詢所有管理員
            const admins = await db.query(async (client) => {
              return client.user.findMany({
                where: { role: 'ADMIN' },
                select: { id: true },
              });
            }, 'bookings:cancel:find-admins');

            // 建立站內通知（用戶本人 + 管理員）
            await db.query(async (client) => {
              // 用戶本人
              await client.personalNotification.create({
                data: {
                  userId,
                  senderId: userId,
                  title: '頻繁取消預約警告',
                  content: `您在 7 天內已取消 ${recentCancellations.length} 次預約，請留意後續使用規範。`,
                  type: 'WARNING',
                  priority: 'HIGH',
                },
              });

              // 管理員
              for (const admin of admins) {
                await client.personalNotification.create({
                  data: {
                    userId: admin.id,
                    senderId: userId,
                    title: '用戶頻繁取消預約警告',
                    content: `用戶 ${userName} 在 7 天內取消 ${recentCancellations.length} 次預約，請留意。`,
                    type: 'WARNING',
                    priority: 'HIGH',
                  },
                });
              }
            }, 'bookings:cancel:notify-admins');

            // 發送警告郵件給用戶（需有有效 email）
            if (canSendEmail) {
              await sendWarningEmail(
                userEmail as string,
                userName,
                {
                  cancellationCount: recentCancellations.length,
                  warningType: 'FREQUENT_CANCELLATIONS',
                }
              );
            }
          }
        } catch (error) {
          console.error('❌ 檢查取消頻率失敗:', error);
          // 不影響取消預約的成功
        }
      }).catch((error) => {
        console.error('❌ 異步檢查取消頻率失敗:', error);
      });
    }

    return NextResponse.json({
      success: true,
      message: '預約已成功取消',
      booking: result.booking,
    });
  } catch (error) {
    return createErrorResponse(error, 'bookings:cancel');
  }
} 