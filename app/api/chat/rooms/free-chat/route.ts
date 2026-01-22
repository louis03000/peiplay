import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/rooms/free-chat
 * 創建或獲取免費聊天室（不關聯booking，每日限制10則訊息）
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const body = await request.json();
    const { partnerId } = body;

    if (!partnerId) {
      return NextResponse.json(
        { error: '需要提供 partnerId' },
        { status: 400 }
      );
    }

    const result = await db.query(async (client) => {
      // 檢查模型是否存在
      try {
        const testQuery = (client as any).chatRoom;
        if (!testQuery) {
          throw new Error('聊天功能尚未啟用，請先執行資料庫 migration');
        }
      } catch (error) {
        throw new Error('聊天功能尚未啟用，請先執行資料庫 migration');
      }

      // 獲取夥伴的userId
      const partner = await (client as any).partner.findUnique({
        where: { id: partnerId },
        select: { userId: true },
      });

      if (!partner) {
        throw new Error('夥伴不存在');
      }

      // 檢查是否已經存在免費聊天室（沒有bookingId的聊天室）
      // 查找包含這兩個用戶的所有免費聊天室
      const existingRooms = await (client as any).chatRoom.findMany({
        where: {
          bookingId: null,
          groupBookingId: null,
          multiPlayerBookingId: null,
          type: 'ONE_ON_ONE',
          members: {
            some: {
              userId: {
                in: [session.user.id, partner.userId],
              },
            },
          },
        },
        include: {
          members: {
            select: {
              userId: true,
            },
          },
        },
      });

      // 查找包含這兩個用戶且只有這兩個用戶的聊天室
      const existingRoom = existingRooms.find((room: any) => {
        const memberIds = room.members.map((m: any) => m.userId);
        return (
          memberIds.includes(session.user.id) &&
          memberIds.includes(partner.userId) &&
          memberIds.length === 2
        );
      });

      // 如果存在且成員正確，返回現有聊天室
      if (existingRoom) {
        return { roomId: existingRoom.id, created: false };
      }

      // 創建新的免費聊天室
      const room = await (client as any).chatRoom.create({
        data: {
          type: 'ONE_ON_ONE',
          bookingId: null,
          groupBookingId: null,
          multiPlayerBookingId: null,
          members: {
            create: [
              { userId: session.user.id },
              { userId: partner.userId },
            ],
          },
        },
      });

      return { roomId: room.id, created: true };
    }, 'chat:rooms:free-chat:post');

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:free-chat:post');
  }
}

