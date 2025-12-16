import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chatrooms/{chatId}/meta
 * 輕量 meta endpoint：只回傳最後訊息時間和訊息數量
 * 
 * 用途：前端輪詢時先檢查 meta，只有當 lastMessageAt 改變時才拉取完整訊息
 * 
 * 回傳：{ lastMessageAt, messageCount, isClosed }
 */
export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { chatId } = params;

    const result = await db.query(async (client) => {
      // 只查詢 pre_chat_rooms 表（極快，使用索引）
      const room = await (client as any).preChatRoom.findUnique({
        where: { id: chatId },
        select: {
          userId: true,
          partnerId: true,
          lastMessageAt: true,
          messageCount: true,
          status: true,
          expiresAt: true,
        },
      });

      if (!room) {
        throw new Error('聊天室不存在');
      }

      // 檢查權限
      if (room.userId !== session.user.id && room.partnerId !== session.user.id) {
        throw new Error('無權限訪問此聊天室');
      }

      // 檢查是否過期
      const isExpired = new Date(room.expiresAt) < new Date();
      const isClosed = isExpired || room.status !== 'open';

      return {
        lastMessageAt: room.lastMessageAt?.toISOString() || null,
        messageCount: room.messageCount,
        isClosed,
      };
    }, 'chatrooms:chatId:meta:get');

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
      },
    });
  } catch (error: any) {
    if (error.message?.includes('聊天室') || error.message?.includes('權限')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return createErrorResponse(error, 'chatrooms:chatId:meta:get');
  }
}

