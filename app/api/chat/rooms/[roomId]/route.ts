import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/rooms/[roomId]
 * 獲取聊天室詳情
 */
export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { roomId } = params;

    const result = await db.query(async (client) => {
      // 檢查用戶是否有權限訪問此聊天室
      const membership = await client.chatRoomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: session.user.id,
          },
        },
      });

      // 如果是管理員，允許訪問
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!membership && user?.role !== 'ADMIN') {
        throw new Error('無權限訪問此聊天室');
      }

      // 獲取聊天室詳情（優化：只加載必要數據）
      const room = await client.chatRoom.findUnique({
        where: { id: roomId },
        select: {
          id: true,
          type: true,
          bookingId: true,
          groupBookingId: true,
          multiPlayerBookingId: true,
          createdAt: true,
          updatedAt: true,
          lastMessageAt: true,
          members: {
            select: {
              id: true,
              userId: true,
              joinedAt: true,
              lastReadAt: true,
              isActive: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          // 只在需要時加載 booking 和 groupBooking（延遲加載）
        },
      });

      if (!room) {
        throw new Error('聊天室不存在');
      }

      return room;
    }, 'chat:rooms:roomId:get');

    return NextResponse.json({ room: result });
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:get');
  }
}

