export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import ExcelJS from 'exceljs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('export') === 'excel') {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.email || session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Only admin can export' }, { status: 403 })
      }
      const customer = await prisma.customer.findFirst({
        where: { user: { email: session.user.email } }
      })
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
      const orders = await prisma.order.findMany({
        where: { customerId: customer.id },
        include: {
          booking: {
            include: {
              schedule: { include: { partner: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      // 準備 Excel
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('消費紀錄');
      sheet.columns = [
        { header: '預約日期', key: 'date', width: 15 },
        { header: '開始時間', key: 'start', width: 10 },
        { header: '結束時間', key: 'end', width: 10 },
        { header: '夥伴姓名', key: 'partner', width: 15 },
        { header: '總時長(分鐘)', key: 'duration', width: 15 },
        { header: '每半小時收費', key: 'rate', width: 15 },
        { header: '總收費金額', key: 'total', width: 15 },
      ];
      for (const order of orders) {
        const s = order.booking?.schedule;
        const partner = s?.partner as any;
        if (!s || !partner) continue;
        const start = new Date(s.startTime);
        const end = new Date(s.endTime);
        const duration = Math.round((end.getTime() - start.getTime()) / 60000); // 分鐘
        const halfHourlyRate = partner.halfHourlyRate || 0;
        const total = Math.round(duration / 30 * halfHourlyRate);
        sheet.addRow({
          date: start.toLocaleDateString('zh-TW'),
          start: start.toTimeString().slice(0,5),
          end: end.toTimeString().slice(0,5),
          partner: partner.name,
          duration,
          rate: halfHourlyRate,
          total
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
    } catch (error) {
      return NextResponse.json({ error: 'Excel 匯出失敗', detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
  }
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customer = await prisma.customer.findFirst({
      where: {
        user: {
          email: session.user.email
        }
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const orders = await prisma.order.findMany({
      where: {
        customerId: customer.id
      },
      include: {
        booking: {
          include: {
            schedule: {
              include: {
                partner: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 