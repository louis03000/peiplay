import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { sendBookingNotificationEmail } from '@/lib/email';
import { BookingStatus } from '@prisma/client';
import { checkTimeConflict } from '@/lib/time-conflict';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Handles the creation of new bookings.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { scheduleIds } = await request.json();

    if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json({ error: 'Valid schedule IDs were not provided' }, { status: 400 });
    }

    console.log('🔍 開始創建預約流程...')
    
    const result = await db.query(async (client) => {
      console.log('🔍 查詢客戶資料...')
      // 只選擇必要的欄位
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (!customer) {
        console.log('❌ 找不到客戶資料')
        return { type: 'NO_CUSTOMER' } as const;
      }
      
      console.log('✅ 客戶資料找到:', customer.id)

      console.log('🔍 開始創建預約，scheduleIds:', scheduleIds)
      
      const entries = await client.$transaction(async (tx) => {
        const records: Array<{
          bookingId: string;
          partnerEmail: string;
          partnerName: string;
          customerName: string;
          customerEmail: string;
          startTime: Date;
          endTime: Date;
          durationHours: number;
          totalCost: number;
        }> = [];

        for (const scheduleId of scheduleIds) {
          console.log(`🔍 處理時段 ${scheduleId}...`)
          // 只选择必要的字段，减少查询时间
          const schedule = await tx.schedule.findUnique({
            where: { id: scheduleId },
            select: {
              id: true,
              partnerId: true,
              startTime: true,
              endTime: true,
              partner: {
                select: {
                  halfHourlyRate: true,
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

          if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
          }

          const conflict = await checkTimeConflict(
            schedule.partnerId,
            schedule.startTime,
            schedule.endTime,
            undefined,
            tx
          );

          if (conflict.hasConflict) {
            const conflictTimes = conflict.conflicts
              .map((c) => `${new Date(c.startTime).toLocaleString('zh-TW')} - ${new Date(c.endTime).toLocaleString('zh-TW')}`)
              .join(', ');

            throw new Error(`時間衝突！該夥伴在以下時段已有預約：${conflictTimes}`);
          }

          const durationHours =
            (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
          const originalAmount = durationHours * schedule.partner.halfHourlyRate * 2;

          console.log(`🔍 創建預約記錄，時段: ${scheduleId}`)
          const booking = await tx.booking.create({
            data: {
              customerId: customer.id,
              scheduleId,
              status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
              originalAmount,
              finalAmount: originalAmount,
            },
          });
          console.log(`✅ 預約創建成功: ${booking.id}`)

          records.push({
            bookingId: booking.id,
            partnerEmail: schedule.partner.user.email,
            partnerName: schedule.partner.user.name || '夥伴',
            customerName: customer.user.name || '客戶',
            customerEmail: customer.user.email,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            durationHours,
            totalCost: originalAmount,
          });
        }

        return records;
      }, {
        maxWait: 10000, // 等待事務開始的最大時間（10秒）
        timeout: 20000, // 事務執行的最大時間（20秒）
      });

      console.log('✅ 所有預約創建完成，共', entries.length, '筆')
      return { type: 'SUCCESS', customer, entries } as const;
    }, 'bookings:create');

    if (result.type === 'NO_CUSTOMER') {
      console.log('❌ 客戶資料不存在')
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 送出通知（非阻塞）
    for (const entry of result.entries) {
      sendBookingNotificationEmail(
        entry.partnerEmail,
        entry.partnerName,
        result.customer.user.name || '客戶',
        {
          bookingId: entry.bookingId,
          startTime: entry.startTime.toISOString(),
          endTime: entry.endTime.toISOString(),
          duration: entry.durationHours,
          totalCost: entry.totalCost,
          customerName: entry.customerName,
          customerEmail: entry.customerEmail,
        }
      ).catch((error) => {
        console.error('❌ Email 發送失敗:', error);
      });
    }

    return NextResponse.json({
      bookings: result.entries.map((entry) => ({
        id: entry.bookingId,
        status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
        message: '預約創建成功，已通知夥伴',
      })),
    });
  } catch (error) {
    console.error('❌ 創建預約失敗:', error)
    console.error('錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    return createErrorResponse(error, 'bookings:create');
  }
}

/**
 * Fetches bookings based on the user's role.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const bookings = await db.query(async (client) => {
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!customer) {
        return null;
      }

      return client.booking.findMany({
        where: { customerId: customer.id },
        include: {
          schedule: {
            include: {
              partner: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      });
    }, 'bookings:list');

    if (bookings === null) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    return NextResponse.json({ bookings });
  } catch (error) {
    return createErrorResponse(error, 'bookings:list');
  }
} 