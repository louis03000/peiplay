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

      const messages = await (client as any).chatMessage.findMany({
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

/**
 * POST /api/chat/rooms/[roomId]/messages
 * 發送訊息到聊天室（當 WebSocket 不可用時的後備方案）
 */
export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { roomId } = params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: '訊息內容不能為空' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      // 驗證用戶是否有權限
      const membership = await (client as any).chatRoomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: session.user.id,
          },
        },
      });

      if (!membership) {
        throw new Error('無權限訪問此聊天室');
      }

      // 檢查是否是免費聊天室並驗證消息限制
      const room = await (client as any).chatRoom.findUnique({
        where: { id: roomId },
        select: {
          bookingId: true,
          groupBookingId: true,
          multiPlayerBookingId: true,
        },
      });

      const isFreeChat =
        !room?.bookingId && !room?.groupBookingId && !room?.multiPlayerBookingId;

      if (isFreeChat) {
        // 計算用戶已發送的消息數量
        const userMessageCount = await (client as any).chatMessage.count({
          where: {
            roomId,
            senderId: session.user.id,
          },
        });

        const FREE_CHAT_LIMIT = 5;
        if (userMessageCount >= FREE_CHAT_LIMIT) {
          throw new Error(`免費聊天句數上限為${FREE_CHAT_LIMIT}句，您已達到上限`);
        }
      }

      // 簡單的內容審查（關鍵字過濾）
      const blockedKeywords = ['垃圾', 'spam'];
      const hasBlockedKeyword = blockedKeywords.some((keyword) =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      // 創建訊息
      const message = await (client as any).chatMessage.create({
        data: {
          roomId,
          senderId: session.user.id,
          content: content.trim(),
          contentType: 'TEXT',
          status: 'SENT',
          moderationStatus: hasBlockedKeyword ? 'FLAGGED' : 'APPROVED',
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      // 更新聊天室最後訊息時間
      await (client as any).chatRoom.update({
        where: { id: roomId },
        data: { lastMessageAt: new Date() },
      });

      return {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        sender: message.sender,
        content: message.content,
        contentType: message.contentType,
        status: message.status,
        moderationStatus: message.moderationStatus,
        createdAt: message.createdAt.toISOString(),
      };
    }, 'chat:rooms:roomId:messages:post');

    return NextResponse.json({ message: result });
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:messages:post');
  }
}
