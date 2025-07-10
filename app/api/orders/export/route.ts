import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 取得所有消費紀錄（訂單）
    const orders = await prisma.order.findMany({
      include: {
        customer: { select: { name: true } },
        booking: {
          include: {
            schedule: {
              include: { partner: { select: { name: true, halfHourlyRate: true } } }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 建立 Excel 檔案
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('消費紀錄');
    worksheet.columns = [
      { header: '預約日期', key: 'date', width: 15 },
      { header: '開始時間', key: 'start', width: 12 },
      { header: '結束時間', key: 'end', width: 12 },
      { header: '夥伴姓名', key: 'partner', width: 15 },
      { header: '顧客姓名', key: 'customer', width: 15 },
      { header: '總時長(分鐘)', key: 'duration', width: 15 },
      { header: '每半小時收費', key: 'rate', width: 15 },
      { header: '總收費金額', key: 'amount', width: 15 },
      { header: '建立時間', key: 'created', width: 20 },
    ];

    for (const order of orders) {
      const schedule = order.booking?.schedule;
      const partner = schedule?.partner;
      const start = schedule?.startTime ? new Date(schedule.startTime) : null;
      const end = schedule?.endTime ? new Date(schedule.endTime) : null;
      const duration = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : '';
      worksheet.addRow({
        date: start ? start.toLocaleDateString('zh-TW') : '',
        start: start ? start.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        end: end ? end.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        partner: partner?.name || '',
        customer: order.customer?.name || '',
        duration,
        rate: partner?.halfHourlyRate || '',
        amount: order.amount,
        created: order.createdAt ? new Date(order.createdAt).toLocaleString('zh-TW') : '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="orders.xlsx"`
      }
    });
  } catch (error: any) {
    console.error('Export orders excel error:', error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
} 