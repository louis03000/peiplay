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
      console.log('🔍 查詢客戶資料，userId:', session.user.id)
      
      let customer;
      try {
        // 只選擇必要的欄位
        customer = await client.customer.findUnique({
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
      } catch (customerError: any) {
        console.error('❌ 查詢客戶資料失敗:', {
          code: customerError?.code,
          message: customerError?.message,
          meta: customerError?.meta,
        });
        throw customerError;
      }

      if (!customer) {
        console.log('❌ 找不到客戶資料')
        return { type: 'NO_CUSTOMER' } as const;
      }
      
      console.log('✅ 客戶資料找到:', customer.id)

      console.log('🔍 開始創建預約，scheduleIds:', scheduleIds)
      
      let entries;
      try {
        entries = await client.$transaction(async (tx) => {
          // 優化：批量查詢所有時段，避免 N+1 查詢問題
          console.log(`🔍 批量查詢 ${scheduleIds.length} 個時段...`)
          const schedules = await tx.schedule.findMany({
            where: { id: { in: scheduleIds } },
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

          // 檢查是否所有時段都存在
          const scheduleMap = new Map(schedules.map(s => [s.id, s]));
          for (const scheduleId of scheduleIds) {
            if (!scheduleMap.has(scheduleId)) {
              throw new Error(`時段不存在: ${scheduleId}`);
            }
          }

          // 批量查詢所有現有預約，避免 N+1 查詢
          const existingBookings = await tx.booking.findMany({
            where: { scheduleId: { in: scheduleIds } },
            select: { id: true, status: true, scheduleId: true },
          });
          const existingBookingMap = new Map(existingBookings.map(b => [b.scheduleId, b]));

          // 檢查是否有已被預約的時段
          for (const scheduleId of scheduleIds) {
            const existingBooking = existingBookingMap.get(scheduleId);
            if (existingBooking) {
              throw new Error(`時段已被預約（預約編號: ${existingBooking.id}）`);
            }
          }

          // 批量檢查時間衝突（收集所有需要檢查的夥伴和時間）
          const partnerTimeChecks = new Map<string, Array<{ startTime: Date; endTime: Date; scheduleId: string }>>();
          for (const schedule of schedules) {
            if (!partnerTimeChecks.has(schedule.partnerId)) {
              partnerTimeChecks.set(schedule.partnerId, []);
            }
            partnerTimeChecks.get(schedule.partnerId)!.push({
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              scheduleId: schedule.id,
            });
          }

          // 為每個夥伴檢查時間衝突
          for (const [partnerId, timeRanges] of partnerTimeChecks) {
            for (const timeRange of timeRanges) {
              try {
                const conflict = await checkTimeConflict(
                  partnerId,
                  timeRange.startTime,
                  timeRange.endTime,
                  undefined,
                  tx
                );
                if (conflict.hasConflict) {
                  const conflictTimes = conflict.conflicts
                    .map((c) => `${new Date(c.startTime).toLocaleString('zh-TW')} - ${new Date(c.endTime).toLocaleString('zh-TW')}`)
                    .join(', ');
                  throw new Error(`時間衝突！該夥伴在以下時段已有預約：${conflictTimes}`);
                }
              } catch (conflictError: any) {
                if (conflictError.message.includes('時間衝突')) {
                  throw conflictError;
                }
                console.error(`❌ 檢查時間衝突失敗 (${timeRange.scheduleId}):`, {
                  message: conflictError?.message,
                  stack: conflictError?.stack,
                });
                throw new Error(`檢查時間衝突失敗: ${conflictError?.message || '未知錯誤'}`);
              }
            }
          }

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

          // 創建所有預約
          for (const schedule of schedules) {
            const durationHours =
              (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
            const originalAmount = durationHours * schedule.partner.halfHourlyRate * 2;

            const bookingData: any = {
              customerId: customer.id,
              partnerId: schedule.partnerId,
              scheduleId: schedule.id,
              status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
              originalAmount,
              finalAmount: originalAmount,
            };
            
            let booking;
            try {
              booking = await tx.booking.create({
                data: bookingData,
              });
            } catch (createError: any) {
              console.error(`❌ 創建預約失敗 (時段: ${schedule.id}):`, {
                code: createError?.code,
                message: createError?.message,
                meta: createError?.meta,
              });
              
              // 處理 Prisma 特定錯誤
              if (createError?.code === 'P2002') {
                const target = createError?.meta?.target as string[] || [];
                if (target.includes('scheduleId')) {
                  throw new Error(`時段已被預約，請選擇其他時段`);
                }
                throw new Error(`資料衝突: ${target.join(', ')}`);
              }
              
              if (createError?.code === 'P2003') {
                throw new Error(`關聯資料錯誤: ${createError?.message}`);
              }
              
              if (createError?.code === 'P2036') {
                throw new Error(`資料庫欄位不存在: ${createError?.message}`);
              }
              
              if (createError?.code === 'P2022') {
                throw new Error(`資料值不符合欄位類型: ${createError?.message || '請檢查資料格式'}`);
              }
              
              if (createError?.code === 'P2024' || createError?.code === 'P1008' || createError?.code === 'P1017') {
                throw new Error(`資料庫操作超時，請稍後再試`);
              }
              
              throw createError;
            }

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
      } catch (transactionError: any) {
        console.error('❌ 事務執行失敗:', {
          code: transactionError?.code,
          message: transactionError?.message,
          meta: transactionError?.meta,
          stack: transactionError?.stack,
          name: transactionError?.name,
        });
        throw transactionError;
      }

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
  } catch (error: any) {
    console.error('❌ 創建預約失敗:', error)
    console.error('錯誤詳情:', {
      code: error?.code,
      message: error instanceof Error ? error.message : 'Unknown error',
      meta: error?.meta,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    
    // 如果是 Prisma 錯誤，輸出更詳細的資訊
    if (error?.code) {
      console.error('🔍 Prisma 錯誤代碼:', error.code)
      console.error('🔍 Prisma 錯誤 meta:', JSON.stringify(error.meta, null, 2))
      
      // 根據錯誤代碼返回更友好的錯誤訊息
      if (error.code === 'P2002') {
        const target = error.meta?.target as string[] || [];
        if (target.includes('scheduleId')) {
          return NextResponse.json({
            error: '時段已被預約',
            code: 'SCHEDULE_ALREADY_BOOKED',
            details: '您選擇的時段已被其他用戶預約，請選擇其他時段',
          }, { status: 409 });
        }
      }
      
      // 處理資料庫連接和超時錯誤
      if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error.code)) {
        return NextResponse.json({
          error: '資料庫連接失敗，請稍後再試',
          code: 'DB_CONNECTION_ERROR',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        }, { status: 503 });
      }
    }
    
    // 處理一般錯誤訊息
    const errorMessage = error instanceof Error ? error.message : '資料庫操作失敗';
    
    // 如果是已知的業務邏輯錯誤，返回 400 或 409
    if (errorMessage.includes('時段已被預約') || errorMessage.includes('時間衝突')) {
      return NextResponse.json({
        error: errorMessage,
        code: 'BOOKING_CONFLICT',
      }, { status: 409 });
    }
    
    if (errorMessage.includes('時段不存在') || errorMessage.includes('找不到')) {
      return NextResponse.json({
        error: errorMessage,
        code: 'NOT_FOUND',
      }, { status: 404 });
    }
    
    // 其他錯誤使用標準錯誤處理
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
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          schedule: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              partner: {
                select: { 
                  name: true,
                  id: true,
                },
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