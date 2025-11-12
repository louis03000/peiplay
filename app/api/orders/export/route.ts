import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import * as ExcelJS from 'exceljs';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const bookings = await db.query(async (client) => {
      return client.booking.findMany({
        where: {
          status: {
            in: ['CONFIRMED', 'COMPLETED'],
          },
        },
        include: {
          customer: {
            select: {
              name: true,
              phone: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          schedule: {
            include: {
              partner: {
                select: {
                  name: true,
                  phone: true,
                  halfHourlyRate: true,
                  user: {
                    select: {
                      email: true,
                      discord: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { schedule: { partner: { name: 'asc' } } },
          { createdAt: 'desc' },
        ],
      });
    }, 'orders:export:get-bookings');

    const workbook = new ExcelJS.Workbook();

    const overviewSheet = workbook.addWorksheet('消費紀錄總覽');
    overviewSheet.columns = [
      { header: '訂單編號', key: 'orderNumber', width: 25 },
      { header: '客戶姓名', key: 'customerName', width: 15 },
      { header: '預約日期', key: 'date', width: 12 },
      { header: '服務時段', key: 'timeSlot', width: 20 },
      { header: '時長', key: 'duration', width: 10 },
      { header: '收入', key: 'amount', width: 15 },
      { header: '接單時間', key: 'created', width: 20 },
      { header: '夥伴姓名', key: 'partnerName', width: 15 },
      { header: '夥伴Email', key: 'partnerEmail', width: 25 },
      { header: '夥伴電話', key: 'partnerPhone', width: 15 },
      { header: 'Discord ID', key: 'partnerDiscord', width: 20 },
      { header: '每半小時收費', key: 'rate', width: 15 },
      { header: '客戶Email', key: 'customerEmail', width: 25 },
      { header: '客戶電話', key: 'customerPhone', width: 15 },
      { header: '預約ID', key: 'bookingId', width: 15 },
      { header: '備註', key: 'notes', width: 30 },
    ];

    const settlementSheet = workbook.addWorksheet('夥伴收入結算');
    settlementSheet.columns = [
      { header: '夥伴姓名', key: 'partnerName', width: 20 },
      { header: '夥伴Email', key: 'partnerEmail', width: 25 },
      { header: '夥伴電話', key: 'partnerPhone', width: 15 },
      { header: 'Discord ID', key: 'partnerDiscord', width: 20 },
      { header: '每半小時收費', key: 'halfHourlyRate', width: 15 },
      { header: '總接單數', key: 'totalOrders', width: 12 },
      { header: '總時長(分鐘)', key: 'totalDuration', width: 15 },
      { header: '總時長(小時)', key: 'totalHours', width: 15 },
      { header: '總收入', key: 'totalIncome', width: 15 },
      { header: '平均每單收入', key: 'avgIncome', width: 15 },
      { header: '平均每小時收入', key: 'avgHourlyIncome', width: 18 },
      { header: '應得金額', key: 'settlementAmount', width: 15 },
      { header: '備註', key: 'notes', width: 30 },
    ];

    const partnerStats = new Map<string, any>();

    for (const booking of bookings) {
      const partner = booking.schedule?.partner;
      if (!partner) continue;

      const partnerId = partner.name;
      const schedule = booking.schedule;
      const start = schedule?.startTime ? new Date(schedule.startTime) : null;
      const end = schedule?.endTime ? new Date(schedule.endTime) : null;
      const duration = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;

      if (!partnerStats.has(partnerId)) {
        partnerStats.set(partnerId, {
          partnerName: partner.name,
          partnerEmail: partner.user?.email || '',
          partnerPhone: partner.phone,
          partnerDiscord: partner.user?.discord || '',
          halfHourlyRate: partner.halfHourlyRate,
          totalOrders: 0,
          totalDuration: 0,
          totalIncome: 0,
          orders: [],
        });
      }

      const stats = partnerStats.get(partnerId);
      stats.totalOrders++;
      stats.totalDuration += duration;
      stats.totalIncome += booking.finalAmount;
      stats.orders.push(booking);
    }

    for (const booking of bookings) {
      const partner = booking.schedule?.partner;
      if (!partner) continue;

      const schedule = booking.schedule;
      const start = schedule?.startTime ? new Date(schedule.startTime) : null;
      const end = schedule?.endTime ? new Date(schedule.endTime) : null;
      const duration = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;

      let timeSlot = '';
      if (start && end) {
        const startTime = start.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true });
        const endTime = end.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true });
        timeSlot = `${startTime} - ${endTime}`;
      }

      overviewSheet.addRow({
        orderNumber: booking.orderNumber || '',
        customerName: booking.customer?.name || '',
        date: start ? start.toLocaleDateString('zh-TW') : '',
        timeSlot,
        duration: `${duration} 分鐘`,
        amount: `NT$ ${booking.finalAmount}`,
        created: booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('zh-TW') : '',
        partnerName: partner.name,
        partnerEmail: partner.user?.email || '',
        partnerPhone: partner.phone,
        partnerDiscord: partner.user?.discord || '',
        rate: partner.halfHourlyRate,
        customerEmail: booking.customer?.user?.email || '',
        customerPhone: booking.customer?.phone || '',
        bookingId: booking.id,
        notes: booking.rejectReason || '',
      });
    }

    let grandTotalOrders = 0;
    let grandTotalDuration = 0;
    let grandTotalIncome = 0;

    for (const [, stats] of Array.from(partnerStats)) {
      const totalHours = Math.round((stats.totalDuration / 60) * 100) / 100;
      const avgHourlyIncome = totalHours > 0 ? Math.round(stats.totalIncome / totalHours) : 0;

      grandTotalOrders += stats.totalOrders;
      grandTotalDuration += stats.totalDuration;
      grandTotalIncome += stats.totalIncome;

      settlementSheet.addRow({
        partnerName: stats.partnerName,
        partnerEmail: stats.partnerEmail,
        partnerPhone: stats.partnerPhone,
        partnerDiscord: stats.partnerDiscord,
        halfHourlyRate: stats.halfHourlyRate,
        totalOrders: stats.totalOrders,
        totalDuration: stats.totalDuration,
        totalHours,
        totalIncome: stats.totalIncome,
        avgIncome: stats.totalOrders > 0 ? Math.round(stats.totalIncome / stats.totalOrders) : 0,
        avgHourlyIncome,
        settlementAmount: stats.totalIncome,
        notes: `共${stats.totalOrders}單，總時長${totalHours}小時`,
      });
    }

    const grandTotalHours = Math.round((grandTotalDuration / 60) * 100) / 100;
    settlementSheet.addRow({
      partnerName: '=== 總計 ===',
      partnerEmail: '',
      partnerPhone: '',
      partnerDiscord: '',
      halfHourlyRate: '',
      totalOrders: grandTotalOrders,
      totalDuration: grandTotalDuration,
      totalHours: grandTotalHours,
      totalIncome: grandTotalIncome,
      avgIncome: grandTotalOrders > 0 ? Math.round(grandTotalIncome / grandTotalOrders) : 0,
      avgHourlyIncome: grandTotalHours > 0 ? Math.round(grandTotalIncome / grandTotalHours) : 0,
      settlementAmount: grandTotalIncome,
      notes: `全體夥伴總計：${grandTotalOrders}單，總時長${grandTotalHours}小時，總收入${grandTotalIncome}元`,
    });

    const detailSheet = workbook.addWorksheet('詳細消費紀錄');
    detailSheet.columns = [
      { header: '夥伴姓名', key: 'partnerName', width: 20 },
      { header: '預約ID', key: 'bookingId', width: 15 },
      { header: '訂單編號', key: 'orderNumber', width: 20 },
      { header: '預約日期', key: 'date', width: 15 },
      { header: '開始時間', key: 'start', width: 12 },
      { header: '結束時間', key: 'end', width: 12 },
      { header: '總時長(分鐘)', key: 'duration', width: 15 },
      { header: '每半小時收費', key: 'rate', width: 15 },
      { header: '收費金額', key: 'amount', width: 15 },
      { header: '預約狀態', key: 'bookingStatus', width: 15 },
      { header: '顧客姓名', key: 'customerName', width: 15 },
      { header: '顧客Email', key: 'customerEmail', width: 25 },
      { header: '顧客電話', key: 'customerPhone', width: 15 },
      { header: '建立時間', key: 'created', width: 20 },
      { header: '備註', key: 'notes', width: 30 },
    ];

    for (const [, stats] of Array.from(partnerStats)) {
      detailSheet.addRow({
        partnerName: `=== ${stats.partnerName} 的接單紀錄 (共${stats.totalOrders}單，總收入${stats.totalIncome}元) ===`,
        bookingId: '',
        orderNumber: '',
        date: '',
        start: '',
        end: '',
        duration: '',
        rate: '',
        amount: '',
        bookingStatus: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        created: '',
        notes: '',
      });

      const titleRow = detailSheet.lastRow;
      if (titleRow) {
        titleRow.font = { bold: true, color: { argb: 'FF0000FF' } };
        titleRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' },
        };
      }

      for (const booking of stats.orders) {
        const schedule = booking.schedule;
        const start = schedule?.startTime ? new Date(schedule.startTime) : null;
        const end = schedule?.endTime ? new Date(schedule.endTime) : null;
        const duration = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
        const partner = schedule?.partner;

        detailSheet.addRow({
          partnerName: partner?.name || '',
          bookingId: booking.id || '',
          orderNumber: booking.orderNumber || '',
          date: start ? start.toLocaleDateString('zh-TW') : '',
          start: start ? start.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
          end: end ? end.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
          duration,
          rate: partner?.halfHourlyRate || '',
          amount: booking.finalAmount,
          bookingStatus: booking.status || '未知',
          customerName: booking.customer?.name || '',
          customerEmail: booking.customer?.user?.email || '',
          customerPhone: booking.customer?.phone || '',
          created: booking.createdAt ? new Date(booking.createdAt).toLocaleString('zh-TW') : '',
          notes: booking.rejectReason || '',
        });
      }

      detailSheet.addRow({
        partnerName: `小計：${stats.partnerName}`,
        bookingId: '',
        orderNumber: '',
        date: '',
        start: '',
        end: '',
        duration: stats.totalDuration,
        rate: '',
        amount: stats.totalIncome,
        bookingStatus: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        created: '',
        notes: `接單數：${stats.totalOrders}，平均每單：${stats.totalOrders > 0 ? Math.round(stats.totalIncome / stats.totalOrders) : 0}元`,
      });

      const summaryRow = detailSheet.lastRow;
      if (summaryRow) {
        summaryRow.font = { bold: true, color: { argb: 'FF008000' } };
        summaryRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0FFF0' },
        };
      }

      detailSheet.addRow({});
    }

    const timeSheet = workbook.addWorksheet('時間統計');
    timeSheet.columns = [
      { header: '月份', key: 'month', width: 15 },
      { header: '夥伴姓名', key: 'partnerName', width: 20 },
      { header: '接單數', key: 'orderCount', width: 12 },
      { header: '總時長(小時)', key: 'totalHours', width: 15 },
      { header: '總收入', key: 'totalIncome', width: 15 },
      { header: '平均每小時收入', key: 'avgHourlyIncome', width: 18 },
    ];

    const monthlyStats = new Map<string, any>();

    for (const booking of bookings) {
      const schedule = booking.schedule;
      const partner = schedule?.partner;
      if (!partner) continue;

      const start = schedule?.startTime ? new Date(schedule.startTime) : null;
      if (!start) continue;

      const month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      const monthKey = `${month}-${partner.name}`;

      const end = schedule?.endTime ? new Date(schedule.endTime) : null;
      const duration = start && end ? (end.getTime() - start.getTime()) / (1000 * 60 * 60) : 0;

      if (!monthlyStats.has(monthKey)) {
        monthlyStats.set(monthKey, {
          month,
          partnerName: partner.name,
          orderCount: 0,
          totalHours: 0,
          totalIncome: 0,
        });
      }

      const stats = monthlyStats.get(monthKey);
      stats.orderCount++;
      stats.totalHours += duration;
      stats.totalIncome += booking.finalAmount;
    }

    for (const [, stats] of Array.from(monthlyStats)) {
      timeSheet.addRow({
        month: stats.month,
        partnerName: stats.partnerName,
        orderCount: stats.orderCount,
        totalHours: Math.round(stats.totalHours * 100) / 100,
        totalIncome: stats.totalIncome,
        avgHourlyIncome: stats.totalHours > 0 ? Math.round(stats.totalIncome / stats.totalHours) : 0,
      });
    }

    [overviewSheet, detailSheet, settlementSheet, timeSheet].forEach((sheet) => {
      if (sheet.rowCount > 0) {
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF366092' },
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });

    if (settlementSheet.rowCount > 0) {
      const totalRow = settlementSheet.getRow(settlementSheet.rowCount);
      totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8B0000' },
      };
      totalRow.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="peiplay_consumption_records_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'orders:export');
  }
} 