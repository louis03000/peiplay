export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createErrorResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db-resilience';
import { BookingStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    console.log('📥 Orders API called');
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      console.log('❌ No session or email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Session found:', session.user.email);

    const { searchParams } = request.nextUrl;
    const isExportExcel = searchParams.get('export') === 'excel';

    let result;
    try {
      result = await db.query(async (tx) => {
        console.log('🔍 Looking for customer with email:', session.user.email);
        const customer = await tx.customer.findFirst({
          where: { user: { email: session.user.email } },
        });

        if (!customer) {
          console.log('❌ Customer not found');
          return null;
        }

        console.log('✅ Customer found:', customer.id);

        // 基於預約狀態來獲取消費記錄：顯示所有 CONFIRMED 或 COMPLETED 的預約（排除 CANCELLED 和 REJECTED）
        console.log('🔍 Fetching bookings for customer:', customer.id);
        const bookings = await tx.booking.findMany({
          where: {
            customerId: customer.id,
            status: {
              in: [
                BookingStatus.CONFIRMED,
                BookingStatus.COMPLETED,
                BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
                BookingStatus.PARTNER_ACCEPTED,
              ],
            },
          },
          select: {
            id: true,
            finalAmount: true,
            createdAt: true,
            schedule: {
              select: {
                date: true,
                startTime: true,
                endTime: true,
                partner: {
                  select: {
                    id: true,
                    name: true,
                    halfHourlyRate: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50, // 直接限制為 50 筆，避免查詢過多資料
        });

        console.log('✅ Found bookings:', bookings.length);

      // 優化：直接在查詢時限制為 50 筆，避免查詢過多資料後再刪除
      // 注意：刪除操作應該在背景任務中執行，不應該在查詢 API 中執行
      // 這裡先限制查詢結果，刪除操作移到背景任務

      // 將預約轉換為訂單格式，以便與現有代碼兼容
      // 使用類型守衛來安全地處理日期
      const isDate = (value: unknown): value is Date => value instanceof Date;
      const toISOString = (value: unknown): string => {
        if (isDate(value)) {
          return value.toISOString();
        }
        if (typeof value === 'string') {
          return value;
        }
        // 如果是其他類型，嘗試轉換為 Date
        try {
          return new Date(value as string | number).toISOString();
        } catch {
          return String(value);
        }
      };
      
      const orders = bookings.slice(0, 50)
        .filter(booking => {
          // 確保有必要的數據
          if (!booking.schedule || !booking.schedule.partner) {
            return false;
          }
          // 確保日期字段存在
          if (!booking.schedule.date || !booking.schedule.startTime || !booking.schedule.endTime) {
            return false;
          }
          return true;
        })
        .map(booking => {
          try {
            return {
              id: booking.id,
              customerId: customer.id,
              bookingId: booking.id,
              amount: Math.round(booking.finalAmount || 0),
              createdAt: toISOString(booking.createdAt),
              booking: {
                schedule: {
                  partner: booking.schedule.partner,
                  date: toISOString(booking.schedule.date),
                  startTime: toISOString(booking.schedule.startTime),
                  endTime: toISOString(booking.schedule.endTime),
                },
              },
            };
          } catch (err) {
            console.error('Error mapping booking:', booking.id, err);
            return null;
          }
        })
        .filter((order): order is NonNullable<typeof order> => order !== null);

        console.log('✅ Orders mapped successfully:', orders.length);
        return { customer, orders };
      }, isExportExcel ? 'orders:export' : 'orders:list');
    } catch (dbError) {
      console.error('❌ Database query error:', dbError);
      throw dbError;
    }

    if (!result) {
      console.log('❌ Result is null');
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { orders } = result;
    console.log('✅ Returning orders:', orders.length);

    if (isExportExcel) {
      const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('消費紀錄');

        sheet.columns = [
          { header: '預約日期', key: 'date', width: 15 },
        { header: '開始時間', key: 'start', width: 12 },
        { header: '結束時間', key: 'end', width: 12 },
        { header: '夥伴姓名', key: 'partner', width: 18 },
        { header: '總時長(分鐘)', key: 'duration', width: 16 },
        { header: '每半小時收費', key: 'rate', width: 18 },
        { header: '總收費金額', key: 'total', width: 16 },
        ];

        for (const order of orders) {
        const schedule = order.booking?.schedule;
        const partner = schedule?.partner;

        if (!schedule || !partner || !schedule.startTime || !schedule.endTime) {
          continue;
        }

        // 安全地轉換日期：Prisma 返回的 DateTime 可能是 Date 對象或字符串
        // 使用類型守衛來檢查是否為 Date 對象
        const isDate = (value: unknown): value is Date => value instanceof Date;
        const start = isDate(schedule.startTime) 
          ? schedule.startTime 
          : new Date(schedule.startTime as string | number);
        const end = isDate(schedule.endTime) 
          ? schedule.endTime 
          : new Date(schedule.endTime as string | number);
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
          const halfHourlyRate = partner.halfHourlyRate || 0;
        const totalAmount = Math.round((durationMinutes / 30) * halfHourlyRate);

          sheet.addRow({
            date: start.toLocaleDateString('zh-TW'),
          start: start.toTimeString().slice(0, 5),
          end: end.toTimeString().slice(0, 5),
            partner: partner.name,
          duration: durationMinutes,
            rate: halfHourlyRate,
          total: totalAmount,
          });
        }

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="orders-${Date.now()}.xlsx"`,
          },
        });
    }

    // 個人資料使用 private cache（只在用戶瀏覽器中快取）
    const response = NextResponse.json(
      { orders },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
    console.log('✅ Response created successfully');
    return response;
  } catch (error) {
    console.error('❌ Orders API Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    // 返回更詳細的錯誤信息以便調試
    return NextResponse.json(
      {
        error: 'Failed to load orders',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
} 