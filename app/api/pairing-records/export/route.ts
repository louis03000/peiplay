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

    // 獲取所有配對記錄
    // 注意：Prisma schema 中 PairingRecord 沒有直接關聯 Booking，需要透過 bookingId 查詢
    const pairingRecords = await db.query(async (client) => {
      return client.pairingRecord.findMany({
        orderBy: {
          timestamp: 'desc',
        },
      });
    }, 'pairing-records:export:get-records');

    // 獲取所有相關的 Booking 資訊
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

    // 建立 bookingId 到 booking 的映射
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    // 處理配對記錄資料
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
        // 從 Booking 獲取正確的夥伴和顧客資訊
        // 夥伴是 schedule.partner，顧客是 booking.customer
        partnerDiscord = booking.schedule.partner.user?.discord || '';
        customerDiscord = booking.customer.user?.discord || '';
        partnerName = booking.schedule.partner.name || '';
      } else if (record.bookingId && !record.bookingId.startsWith('manual_')) {
        // 如果有 bookingId 但找不到 booking，可能是資料不一致
        // 嘗試透過 user1Id 和 user2Id 查找對應的 User 來獲取 Discord 名字
        // 但無法確定誰是夥伴誰是顧客，暫時跳過或標記為未知
        console.warn(`找不到 booking: ${record.bookingId}`);
        continue;
      } else {
        // manual_ 前綴的手動配對，無法確定夥伴和顧客
        // 跳過這些記錄或使用 user1Id 和 user2Id
        console.warn(`手動配對記錄，無法確定夥伴和顧客: ${record.id}`);
        continue;
      }

      // 使用 timestamp 作為日期和時間
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

    // 按夥伴 Discord 名字分組
    const recordsByPartner = new Map<string, PairingRecordData[]>();
    for (const record of records) {
      // 使用夥伴 Discord 名字作為分組鍵
      const partnerKey = record.partnerDiscord || '未知';
      if (!recordsByPartner.has(partnerKey)) {
        recordsByPartner.set(partnerKey, []);
      }
      recordsByPartner.get(partnerKey)!.push(record);
    }

    // 按夥伴 Discord 名字排序
    const sortedPartners = Array.from(recordsByPartner.keys()).sort();

    // 建立 Excel 工作簿
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('訂單記錄');

    // 設定列標題
    sheet.columns = [
      { header: '日期', key: 'date', width: 15 },
      { header: '時間', key: 'time', width: 15 },
      { header: '時長(分鐘)', key: 'duration', width: 15 },
      { header: '夥伴 Discord 名字', key: 'partnerDiscord', width: 25 },
      { header: '顧客 Discord 名字', key: 'customerDiscord', width: 25 },
    ];

    // 設定標題行樣式
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // 按夥伴分組新增資料
    for (const partnerKey of sortedPartners) {
      const partnerRecords = recordsByPartner.get(partnerKey)!;
      
      // 按時間排序（最新的在前）
      partnerRecords.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // 新增該夥伴的所有記錄
      for (const record of partnerRecords) {
        sheet.addRow({
          date: record.date,
          time: record.time,
          duration: record.duration,
          partnerDiscord: record.partnerDiscord,
          customerDiscord: record.customerDiscord,
        });
      }

      // 在不同夥伴之間新增空行
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

