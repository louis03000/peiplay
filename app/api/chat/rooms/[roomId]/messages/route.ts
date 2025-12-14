import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/rooms/[roomId]/messages
 * 獲取聊天室訊息歷史
 * ✅ 關鍵優化：使用 denormalized 字段，不 JOIN users 表（業界標準做法）
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

      // ✅ 關鍵優化：不使用 JOIN，只查 messages 表（denormalized 字段）
      // 這是業界聊天系統標準做法，避免 JOIN 導致的效能問題
      const messages = await (client as any).chatMessage.findMany({
        where,
        select: {
          id: true,
          roomId: true,
          senderId: true,
          senderName: true,        // 去正規化字段
          senderAvatarUrl: true,   // 去正規化字段
          content: true,
          contentType: true,
          status: true,
          moderationStatus: true,
          createdAt: true,
          // ❌ 不再 JOIN sender（避免 JOIN 導致的效能問題）
        },
        // 優化：使用複合索引 (roomId, createdAt DESC)
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' }, // 確保排序穩定（處理相同時間戳）
        ],
        take: limit,
      });

      // 反轉順序（從舊到新，前端顯示用）
      // 轉換格式以保持向後兼容
      return messages.reverse().map((msg: any) => ({
        id: msg.id,
        roomId: msg.roomId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderAvatarUrl: msg.senderAvatarUrl,
        content: msg.content,
        contentType: msg.contentType,
        status: msg.status,
        moderationStatus: msg.moderationStatus,
        createdAt: msg.createdAt,
        // 保持向後兼容的 sender 結構
        sender: {
          id: msg.senderId,
          name: msg.senderName,
          email: '', // 不再需要 email
          role: '',  // 不再需要 role
          avatarUrl: msg.senderAvatarUrl,
        },
      }));
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

      // ✅ 關鍵優化：發送消息時寫入 denormalized 字段（sender_name, sender_avatar_url）
      // 先查詢用戶信息（一次性查詢）
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: {
          name: true,
          partner: {
            select: {
              coverImage: true,
            },
          },
        },
      });

      // 獲取頭像 URL（優先使用 partner 的 coverImage）
      const avatarUrl = user?.partner?.coverImage || null;
      const senderName = user?.name || session.user.email || '未知用戶';

      // 創建訊息並寫入 denormalized 字段
      const message = await (client as any).chatMessage.create({
        data: {
          roomId,
          senderId: session.user.id,
          senderName: senderName,        // 去正規化：寫入發送時的快照
          senderAvatarUrl: avatarUrl,    // 去正規化：寫入發送時的快照
          content: content.trim(),
          contentType: 'TEXT',
          status: 'SENT',
          moderationStatus: hasBlockedKeyword ? 'FLAGGED' : 'APPROVED',
        },
        select: {
          id: true,
          roomId: true,
          senderId: true,
          senderName: true,
          senderAvatarUrl: true,
          content: true,
          contentType: true,
          status: true,
          moderationStatus: true,
          createdAt: true,
          // ❌ 不再 include sender（避免 JOIN）
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

      // 返回格式保持向後兼容
      return {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderAvatarUrl: message.senderAvatarUrl,
        content: message.content,
        contentType: message.contentType,
        status: message.status,
        moderationStatus: message.moderationStatus,
        createdAt: message.createdAt.toISOString(),
        // 保持向後兼容的 sender 結構
        sender: {
          id: message.senderId,
          name: message.senderName,
          email: '',
          role: '',
          avatarUrl: message.senderAvatarUrl,
        },
      };
    }, 'chat:rooms:roomId:messages:post');

    return NextResponse.json({ message: result });
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:messages:post');
  }
}
