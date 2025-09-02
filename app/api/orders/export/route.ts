import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as ExcelJS from 'exceljs';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

            // 取得所有消費紀錄（訂單），包含完整的關聯資料
        const orders = await prisma.order.findMany({
          include: {
            customer: { 
              select: { 
                name: true, 
                phone: true,
                user: {
                  select: {
                    email: true
                  }
                }
              } 
            },
            booking: {
              include: {
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
                            discord: true
                          }
                        }
                      } 
                    } 
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });

    // 建立 Excel 檔案
    const workbook = new ExcelJS.Workbook();
    
    // 1. 總覽工作表
    const overviewSheet = workbook.addWorksheet('消費紀錄總覽');
    overviewSheet.columns = [
      { header: '夥伴姓名', key: 'partnerName', width: 20 },
      { header: '夥伴Email', key: 'partnerEmail', width: 25 },
      { header: '夥伴電話', key: 'partnerPhone', width: 15 },
      { header: 'Discord ID', key: 'partnerDiscord', width: 20 },
      { header: '每半小時收費', key: 'halfHourlyRate', width: 15 },
      { header: '總接單數', key: 'totalOrders', width: 12 },
      { header: '總時長(分鐘)', key: 'totalDuration', width: 15 },
      { header: '總收入', key: 'totalIncome', width: 15 },
      { header: '平均每單收入', key: 'avgIncome', width: 15 },
    ];

    // 按夥伴分組統計
    const partnerStats = new Map();
    
    for (const order of orders) {
      const partner = order.booking?.schedule?.partner;
      if (!partner) continue;
      
      const partnerId = partner.name; // 使用夥伴姓名作為分組鍵
      const schedule = order.booking?.schedule;
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
            orders: []
          });
        }
      
      const stats = partnerStats.get(partnerId);
      stats.totalOrders++;
      stats.totalDuration += duration;
      stats.totalIncome += order.amount;
      stats.orders.push(order);
    }

    // 添加總覽資料
    for (const [partnerId, stats] of Array.from(partnerStats)) {
      overviewSheet.addRow({
        partnerName: stats.partnerName,
        partnerEmail: stats.partnerEmail,
        partnerPhone: stats.partnerPhone,
        partnerDiscord: stats.partnerDiscord,
        halfHourlyRate: stats.halfHourlyRate,
        totalOrders: stats.totalOrders,
        totalDuration: stats.totalDuration,
        totalIncome: stats.totalIncome,
        avgIncome: stats.totalOrders > 0 ? Math.round(stats.totalIncome / stats.totalOrders) : 0
      });
    }

            // 2. 詳細消費紀錄工作表（按夥伴分組）
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

    // 按夥伴分組添加詳細資料
    for (const [partnerId, stats] of Array.from(partnerStats)) {
              // 添加夥伴標題行
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
          notes: ''
        });

      // 設置標題行樣式
      const titleRow = detailSheet.lastRow;
      titleRow.font = { bold: true, color: { argb: 'FF0000FF' } }; // 藍色粗體
      titleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F0F0' } // 淺灰色背景
      };

              // 添加該夥伴的所有訂單
        for (const order of stats.orders) {
          const schedule = order.booking?.schedule;
          const start = schedule?.startTime ? new Date(schedule.startTime) : null;
          const end = schedule?.endTime ? new Date(schedule.endTime) : null;
          const duration = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
          const partner = schedule?.partner;
          
          detailSheet.addRow({
            partnerName: partner?.name || '',
            bookingId: order.booking?.id || '',
            orderNumber: order.booking?.orderNumber || '',
            date: start ? start.toLocaleDateString('zh-TW') : '',
            start: start ? start.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
            end: end ? end.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
            duration: duration,
            rate: partner?.halfHourlyRate || '',
            amount: order.amount,
            bookingStatus: order.booking?.status || '未知',
            customerName: order.customer?.name || '',
            customerEmail: order.customer?.user?.email || '',
            customerPhone: order.customer?.phone || '',
            created: order.createdAt ? new Date(order.createdAt).toLocaleString('zh-TW') : '',
            notes: order.booking?.rejectReason || ''
          });
        }

              // 添加該夥伴的統計行
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
          notes: `接單數：${stats.totalOrders}，平均每單：${stats.totalOrders > 0 ? Math.round(stats.totalIncome / stats.totalOrders) : 0}元`
        });

      // 設置統計行樣式
      const summaryRow = detailSheet.lastRow;
      summaryRow.font = { bold: true, color: { argb: 'FF008000' } }; // 綠色粗體
      summaryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FFF0' } // 淺綠色背景
      };

      // 添加空行分隔
      detailSheet.addRow({});
    }

    // 3. 時間統計工作表
    const timeSheet = workbook.addWorksheet('時間統計');
    timeSheet.columns = [
      { header: '月份', key: 'month', width: 15 },
      { header: '夥伴姓名', key: 'partnerName', width: 20 },
      { header: '接單數', key: 'orderCount', width: 12 },
      { header: '總時長(小時)', key: 'totalHours', width: 15 },
      { header: '總收入', key: 'totalIncome', width: 15 },
      { header: '平均每小時收入', key: 'avgHourlyIncome', width: 18 },
    ];

    // 按月份和夥伴分組統計
    const monthlyStats = new Map();
    
    for (const order of orders) {
      const schedule = order.booking?.schedule;
      const partner = schedule?.partner;
      if (!partner) continue;
      
      const start = schedule?.startTime ? new Date(schedule.startTime) : null;
      if (!start) continue;
      
      const month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      const monthKey = `${month}-${partner.name}`;
      
      const end = schedule?.endTime ? new Date(schedule.endTime) : null;
      const duration = start && end ? (end.getTime() - start.getTime()) / (1000 * 60 * 60) : 0; // 小時
      
      if (!monthlyStats.has(monthKey)) {
        monthlyStats.set(monthKey, {
          month: month,
          partnerName: partner.name,
          orderCount: 0,
          totalHours: 0,
          totalIncome: 0
        });
      }
      
      const stats = monthlyStats.get(monthKey);
      stats.orderCount++;
      stats.totalHours += duration;
      stats.totalIncome += order.amount;
    }

    // 添加時間統計資料
    for (const [monthKey, stats] of Array.from(monthlyStats)) {
      timeSheet.addRow({
        month: stats.month,
        partnerName: stats.partnerName,
        orderCount: stats.orderCount,
        totalHours: Math.round(stats.totalHours * 100) / 100,
        totalIncome: stats.totalIncome,
        avgHourlyIncome: stats.totalHours > 0 ? Math.round(stats.totalIncome / stats.totalHours) : 0
      });
    }

    // 設置樣式
    [overviewSheet, detailSheet, timeSheet].forEach(sheet => {
      // 設置標題行樣式
      if (sheet.rowCount > 0) {
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF366092' } // 深藍色背景
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="peiplay_consumption_records_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });
  } catch (error: any) {
    console.error('Export orders excel error:', error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
} 