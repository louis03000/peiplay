import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/rooms/create-for-existing-bookings
 * 為現有訂單創建聊天室（管理員功能）
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 驗證管理員權限
    const user = await db.query(
      async (client) =>
        await client.user.findUnique({
          where: { id: session.user.id },
          select: { role: true },
        }),
      'chat:create-for-existing:user'
    );

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
    }

    const result = await db.query(async (client) => {
      // 檢查模型是否存在
      const chatRoom = (client as any).chatRoom;
      if (!chatRoom) {
        throw new Error('聊天功能尚未啟用，請先執行資料庫 migration');
      }

      // 獲取所有符合條件的訂單（CONFIRMED, PARTNER_ACCEPTED, COMPLETED）
      const bookings = await client.booking.findMany({
        where: {
          status: {
            in: ['CONFIRMED', 'PARTNER_ACCEPTED', 'COMPLETED'],
          },
        },
        include: {
          customer: { include: { user: true } },
          schedule: { include: { partner: { include: { user: true } } } },
        },
      });

      const createdRooms: any[] = [];
      const skippedRooms: any[] = [];

      for (const booking of bookings) {
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
        totalBookings: bookings.length,
        created: createdRooms.length,
        skipped: skippedRooms.length,
        createdRooms,
        skippedRooms,
      };
    }, 'chat:create-for-existing:post');

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'chat:create-for-existing:post');
  }
}

