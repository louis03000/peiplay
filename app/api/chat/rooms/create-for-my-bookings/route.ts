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

      // 獲取用戶的所有訂單（作為客戶或夥伴）
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      const bookings: any[] = [];

      // 獲取用戶作為客戶的訂單
      if (customer) {
        const customerBookings = await client.booking.findMany({
          where: {
            customerId: customer.id,
            status: {
              in: ['CONFIRMED', 'PARTNER_ACCEPTED', 'COMPLETED', 'PAID_WAITING_PARTNER_CONFIRMATION'],
            },
          },
          include: {
            customer: { include: { user: true } },
            schedule: { include: { partner: { include: { user: true } } } },
          },
        });
        bookings.push(...customerBookings);
      }

      // 獲取用戶作為夥伴的訂單
      if (partner) {
        const partnerBookings = await client.booking.findMany({
          where: {
            schedule: { partnerId: partner.id },
            status: {
              in: ['CONFIRMED', 'PARTNER_ACCEPTED', 'COMPLETED', 'PAID_WAITING_PARTNER_CONFIRMATION'],
            },
          },
          include: {
            customer: { include: { user: true } },
            schedule: { include: { partner: { include: { user: true } } } },
          },
        });
        bookings.push(...partnerBookings);
      }

      // 去重（如果用戶既是客戶又是夥伴，可能會有重複）
      const uniqueBookings = Array.from(
        new Map(bookings.map((b) => [b.id, b])).values()
      );

      const createdRooms: any[] = [];
      const skippedRooms: any[] = [];

      for (const booking of uniqueBookings) {
        // 檢查聊天室是否已存在
        const existingRoom = await chatRoom.findFirst({
          where: { bookingId: booking.id },
        });

        if (existingRoom) {
          skippedRooms.push({ bookingId: booking.id, reason: '已存在' });
          continue;
        }

        // 創建聊天室
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

          createdRooms.push({ bookingId: booking.id, roomId: room.id });
        } catch (error: any) {
          skippedRooms.push({
            bookingId: booking.id,
            reason: error.message || '創建失敗',
          });
        }
      }

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

