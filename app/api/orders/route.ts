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
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const isExportExcel = searchParams.get('export') === 'excel';

    const result = await db.query(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { user: { email: session.user.email } },
      });

        if (!customer) {
        return null;
        }

      // 基於預約狀態來獲取消費記錄：顯示所有 CONFIRMED 或 COMPLETED 的預約（排除 CANCELLED 和 REJECTED）
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
        include: {
          schedule: {
            include: {
              partner: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // 限制最多50筆，超過則刪除最早的
      if (bookings.length > 50) {
        const bookingsToDelete = bookings.slice(50);
        const idsToDelete = bookingsToDelete.map(b => b.id);
        
        // 刪除超過50筆的預約
        await tx.booking.deleteMany({
          where: {
            id: { in: idsToDelete },
          },
        });
      }

      // 將預約轉換為訂單格式，以便與現有代碼兼容
      const orders = bookings.slice(0, 50).map(booking => ({
        id: booking.id,
        customerId: customer.id,
        bookingId: booking.id,
        amount: Math.round(booking.finalAmount || 0),
        createdAt: booking.createdAt,
        booking: {
          schedule: {
            partner: booking.schedule.partner,
            date: booking.schedule.date,
            startTime: booking.schedule.startTime,
            endTime: booking.schedule.endTime,
          },
        },
      }));

      return { customer, orders };
    }, isExportExcel ? 'orders:export' : 'orders:list');

    if (!result) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { orders } = result;

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

        if (!schedule || !partner) {
          continue;
        }

        const start = new Date(schedule.startTime);
        const end = new Date(schedule.endTime);
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

    return NextResponse.json({ orders });
  } catch (error) {
    return createErrorResponse(error, 'orders');
  }
} 