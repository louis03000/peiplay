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

    // 获取所有配对记录
    const pairingRecords = await db.query(async (client) => {
      return client.pairingRecord.findMany({
        include: {
          // 通过bookingId关联到Booking
          // 注意：Prisma schema中PairingRecord没有直接关联Booking，需要通过bookingId查询
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
    }, 'pairing-records:export:get-records');

    // 获取所有相关的Booking信息
    const bookingIds = pairingRecords
      .map((record) => record.bookingId)
      .filter((id): id is string => id !== null && !id.startsWith('manual_'));

    const bookings = await db.query(async (client) => {
      if (bookingIds.length === 0) {
        return [];
      }
      return client.booking.findMany({
        where: {
          id: {
            in: bookingIds,
          },
        },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  discord: true,
                },
              },
            },
          },
          schedule: {
            include: {
              partner: {
                include: {
                  user: {
                    select: {
                      discord: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    }, 'pairing-records:export:get-bookings');

    // 创建bookingId到booking的映射
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    // 处理配对记录数据
    interface PairingRecordData {
      date: string;
      time: string;
      duration: number;
      partnerDiscord: string;
      customerDiscord: string;
      partnerName: string;
      timestamp: Date;
    }

    const records: PairingRecordData[] = [];

    for (const record of pairingRecords) {
      const booking = record.bookingId ? bookingMap.get(record.bookingId) : null;

      let partnerDiscord = '';
      let customerDiscord = '';
      let partnerName = '';

      if (booking && booking.schedule?.partner && booking.customer) {
        // 从Booking获取正确的伙伴和顾客信息
        // 伙伴是schedule.partner，顾客是booking.customer
        partnerDiscord = booking.schedule.partner.user?.discord || '';
        customerDiscord = booking.customer.user?.discord || '';
        partnerName = booking.schedule.partner.name || '';
      } else if (record.bookingId && !record.bookingId.startsWith('manual_')) {
        // 如果有bookingId但找不到booking，可能是数据不一致
        // 尝试通过user1Id和user2Id查找对应的User来获取Discord名字
        // 但无法确定谁是伙伴谁是顾客，暂时跳过或标记为未知
        console.warn(`找不到booking: ${record.bookingId}`);
        continue;
      } else {
        // manual_前缀的手动配对，无法确定伙伴和顾客
        // 跳过这些记录或使用user1Id和user2Id
        console.warn(`手动配对记录，无法确定伙伴和顾客: ${record.id}`);
        continue;
      }

      // 使用timestamp作为日期和时间
      const timestamp = new Date(record.timestamp);
      const date = timestamp.toLocaleDateString('zh-TW');
      const time = timestamp.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      records.push({
        date,
        time,
        duration: record.duration,
        partnerDiscord,
        customerDiscord,
        partnerName,
        timestamp,
      });
    }

    // 按伙伴Discord名字分组
    const recordsByPartner = new Map<string, PairingRecordData[]>();
    for (const record of records) {
      // 使用伙伴Discord名字作为分组键
      const partnerKey = record.partnerDiscord || '未知';
      if (!recordsByPartner.has(partnerKey)) {
        recordsByPartner.set(partnerKey, []);
      }
      recordsByPartner.get(partnerKey)!.push(record);
    }

    // 按伙伴Discord名字排序
    const sortedPartners = Array.from(recordsByPartner.keys()).sort();

    // 创建Excel工作簿
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('訂單記錄');

    // 设置列标题
    sheet.columns = [
      { header: '日期', key: 'date', width: 15 },
      { header: '時間', key: 'time', width: 15 },
      { header: '時長(分鐘)', key: 'duration', width: 15 },
      { header: '夥伴 Discord 名字', key: 'partnerDiscord', width: 25 },
      { header: '顧客 Discord 名字', key: 'customerDiscord', width: 25 },
    ];

    // 设置标题行样式
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // 按伙伴分组添加数据
    for (const partnerKey of sortedPartners) {
      const partnerRecords = recordsByPartner.get(partnerKey)!;
      
      // 按时间排序（最新的在前）
      partnerRecords.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // 添加该伙伴的所有记录
      for (const record of partnerRecords) {
        sheet.addRow({
          date: record.date,
          time: record.time,
          duration: record.duration,
          partnerDiscord: record.partnerDiscord,
          customerDiscord: record.customerDiscord,
        });
      }

      // 在不同伙伴之间添加空行
      if (sortedPartners.indexOf(partnerKey) < sortedPartners.length - 1) {
        sheet.addRow({});
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="訂單記錄_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'pairing-records:export');
  }
}

