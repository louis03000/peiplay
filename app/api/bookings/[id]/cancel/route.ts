import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { BookingStatus } from '@prisma/client';
import { sendAdminNotification } from '@/lib/notifications';
import { sendWarningEmail } from '@/lib/email';

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
        include: { schedule: true },
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

      // 更新預約狀態為已取消
      const updatedBooking = await client.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
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

      // 記錄取消記錄
      await client.bookingCancellation.create({
        data: {
          bookingId: bookingId,
          customerId: customer.id,
          reason: reason.trim(),
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

          // 如果一個禮拜內有三次或以上取消，通知管理員
          if (recentCancellations.length >= 3 && result.customerWithUser?.user) {
            const userEmail = result.customerWithUser.user.email
            const userName = result.customerWithUser.user.name ?? '用戶'

            // 如果沒有 email，就不發送警告郵件，但仍可通知管理員
            const canSendEmail = !!userEmail && typeof userEmail === 'string'

            // 發送管理員通知
            await sendAdminNotification(
              `⚠️ 用戶頻繁取消預約警告`,
              {
                userId: result.customerWithUser.user.id,
                userName,
                userEmail,
                cancellationCount: recentCancellations.length,
                recentCancellations: recentCancellations.slice(0, 3).map(c => ({
                  bookingId: c.bookingId,
                  reason: c.reason,
                  createdAt: c.createdAt,
                })),
              }
            );

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