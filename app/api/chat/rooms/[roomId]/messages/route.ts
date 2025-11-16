import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/rooms/[roomId]/messages
 * 獲取聊天室訊息歷史
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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // 用於分頁

    const result = await db.query(async (client) => {
      // 驗證用戶是否有權限
      const membership = await client.chatRoomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: session.user.id,
          },
        },
      });

      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!membership && user?.role !== 'ADMIN') {
        throw new Error('無權限訪問此聊天室');
      }

      // 獲取訊息
      const where: any = {
        roomId,
        moderationStatus: { not: 'REJECTED' }, // 不顯示被拒絕的訊息
      };

      if (before) {
        where.createdAt = { lt: new Date(before) };
      }

      const messages = await client.chatMessage.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          readReceipts: {
            where: {
              userId: session.user.id,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // 反轉順序（從舊到新）
      return messages.reverse();
    }, 'chat:rooms:roomId:messages:get');

    return NextResponse.json({ messages: result });
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:messages:get');
  }
}

