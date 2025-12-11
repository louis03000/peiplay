import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { createChatRoomForBooking } from '@/lib/chat-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/rooms/create-for-my-bookings
 * 為當前用戶的訂單創建聊天室（如果還沒有）
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const result = await db.query(async (client) => {
      // 檢查模型是否存在
      const chatRoom = (client as any).chatRoom;
      if (!chatRoom) {
        throw new Error('聊天功能尚未啟用，請先執行資料庫 migration');
      }

      const now = new Date();

      // 獲取用戶的所有訂單（作為客戶或夥伴），只包含未結束的訂單
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      const bookings: any[] = [];

      // 優化：並行查詢客戶和夥伴的訂單
      const [customerBookings, partnerBookings] = await Promise.all([
        customer
          ? client.booking.findMany({
              where: {
                customerId: customer.id,
                status: {
                  in: ['CONFIRMED', 'PARTNER_ACCEPTED', 'COMPLETED', 'PAID_WAITING_PARTNER_CONFIRMATION'],
                },
                schedule: {
                  endTime: { gte: now },
                },
              },
              select: {
                id: true,
                customer: {
                  select: {
                    userId: true,
                  },
                },
                schedule: {
                  select: {
                    partner: {
                      select: {
                        userId: true,
                      },
                    },
                  },
                },
              },
            })
          : Promise.resolve([]),
        partner
          ? client.booking.findMany({
              where: {
                schedule: {
                  partnerId: partner.id,
                  endTime: { gte: now },
                },
                status: {
                  in: ['CONFIRMED', 'PARTNER_ACCEPTED', 'COMPLETED', 'PAID_WAITING_PARTNER_CONFIRMATION'],
                },
              },
              select: {
                id: true,
                customer: {
                  select: {
                    userId: true,
                  },
                },
                schedule: {
                  select: {
                    partner: {
                      select: {
                        userId: true,
                      },
                    },
                  },
                },
              },
            })
          : Promise.resolve([]),
      ]);

      bookings.push(...customerBookings, ...partnerBookings);

      // 去重（如果用戶既是客戶又是夥伴，可能會有重複）
      const uniqueBookings = Array.from(
        new Map(bookings.map((b) => [b.id, b])).values()
      );

      if (uniqueBookings.length === 0) {
        return {
          totalBookings: 0,
          created: 0,
          skipped: 0,
          createdRooms: [],
          skippedRooms: [],
        };
      }

      // 批量查詢已存在的聊天室（避免N+1問題）
      const bookingIds = uniqueBookings.map((b) => b.id);
      const existingRooms = await chatRoom.findMany({
        where: {
          bookingId: { in: bookingIds },
        },
        select: {
          bookingId: true,
        },
      });

      const existingBookingIds = new Set(existingRooms.map((r: { bookingId: string | null }) => r.bookingId));

      // 只為沒有聊天室的訂單創建聊天室
      const bookingsToCreate = uniqueBookings.filter(
        (b) => !existingBookingIds.has(b.id)
      );

      const createdRooms: any[] = [];
      const skippedRooms: any[] = [];

      // 批量創建聊天室（使用 Promise.all 並行創建）
      const createPromises = bookingsToCreate.map(async (booking) => {
        try {
          const room = await chatRoom.create({
            data: {
              type: 'ONE_ON_ONE',
              bookingId: booking.id,
              members: {
                create: [
                  { userId: booking.customer.userId },
                  { userId: booking.schedule.partner.userId },
                ],
              },
            },
          });

          return { bookingId: booking.id, roomId: room.id, success: true };
        } catch (error: any) {
          return {
            bookingId: booking.id,
            reason: error.message || '創建失敗',
            success: false,
          };
        }
      });

      const createResults = await Promise.all(createPromises);
      
      createResults.forEach((result) => {
        if (result.success) {
          createdRooms.push({ bookingId: result.bookingId, roomId: result.roomId });
        } else {
          skippedRooms.push({
            bookingId: result.bookingId,
            reason: result.reason,
          });
        }
      });

      // 記錄已存在的聊天室
      uniqueBookings.forEach((b) => {
        if (existingBookingIds.has(b.id)) {
          skippedRooms.push({ bookingId: b.id, reason: '已存在' });
        }
      });

      return {
        totalBookings: uniqueBookings.length,
        created: createdRooms.length,
        skipped: skippedRooms.length,
        createdRooms,
        skippedRooms,
      };
    }, 'chat:create-for-my-bookings:post');

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'chat:create-for-my-bookings:post');
  }
}

