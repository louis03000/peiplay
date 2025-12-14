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
    // 優化：減少默認limit到30，提升查詢速度
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50);
    const before = searchParams.get('before'); // cursor-based pagination

    const result = await db.query(async (client) => {
      // 優化：並行驗證權限（減少等待時間）
      const [membership, user] = await Promise.all([
        client.chatRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: session.user.id,
            },
          },
          select: { id: true }, // 只選必要欄位
        }),
        client.user.findUnique({
          where: { id: session.user.id },
          select: { role: true },
        }),
      ]);

      if (!membership && user?.role !== 'ADMIN') {
        throw new Error('無權限訪問此聊天室');
      }

      // 優化：使用索引 (roomId, createdAt DESC) 查詢
      // WHERE 條件必須匹配索引的第一個欄位（roomId），這樣才能使用索引
      const where: any = {
        roomId, // 必須先匹配索引的第一個欄位
        moderationStatus: { not: 'REJECTED' }, // 不顯示被拒絕的訊息
      };

      // Cursor-based pagination: 使用 created_at < before 來利用索引
      if (before) {
        where.createdAt = { lt: new Date(before) };
      }

      // 優化：只查詢必要欄位，使用索引排序
      const messages = await (client as any).chatMessage.findMany({
        where,
        select: {
          id: true,
          roomId: true,
          senderId: true,
          content: true,
          contentType: true,
          status: true,
          moderationStatus: true,
          createdAt: true,
          // 優化：JOIN sender（避免N+1查詢，但只選必要欄位）
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        // 優化：使用複合索引 (roomId, createdAt DESC)
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' }, // 確保排序穩定（處理相同時間戳）
        ],
        take: limit,
      });

      // 反轉順序（從舊到新，前端顯示用）
      return messages.reverse();
    }, 'chat:rooms:roomId:messages:get');

    // 個人聊天訊息使用 private cache
    return NextResponse.json(
      { messages: result },
      {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        },
      }
    );
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
      // 優化：並行查詢 membership 和 room 信息
      const [membership, room] = await Promise.all([
        (client as any).chatRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: session.user.id,
            },
          },
        }),
        (client as any).chatRoom.findUnique({
          where: { id: roomId },
          select: {
            bookingId: true,
            groupBookingId: true,
            multiPlayerBookingId: true,
          },
        }),
      ]);

      if (!membership) {
        throw new Error('無權限訪問此聊天室');
      }

      const isFreeChat =
        !room?.bookingId && !room?.groupBookingId && !room?.multiPlayerBookingId;

      // 簡單的內容審查（關鍵字過濾）- 同步執行，不等待
      const blockedKeywords = ['垃圾', 'spam'];
      const hasBlockedKeyword = blockedKeywords.some((keyword) =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      // 如果是免費聊天，檢查限制（優化：只在需要時查詢）
      if (isFreeChat) {
        // 優化：使用索引查詢，只計算最近的5條消息
        const recentMessages = await (client as any).chatMessage.findMany({
          where: {
            roomId,
            senderId: session.user.id,
          },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          take: 5, // 只查詢最近5條，不需要全部計數
        });

        const FREE_CHAT_LIMIT = 5;
        if (recentMessages.length >= FREE_CHAT_LIMIT) {
          throw new Error(`免費聊天句數上限為${FREE_CHAT_LIMIT}句，您已達到上限`);
        }
      }

      // 優化：先創建訊息（同步，必須等待）
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

      // 優化：異步更新 lastMessageAt（不阻塞回應）
      // 使用 fire-and-forget 模式，不等待完成
      (client as any).chatRoom
        .update({
          where: { id: roomId },
          data: { lastMessageAt: new Date() },
        })
        .catch((err: any) => {
          // 忽略更新錯誤，不影響消息發送
          console.error('Failed to update lastMessageAt:', err);
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
