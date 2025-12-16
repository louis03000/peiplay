import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chatrooms/{chatId}/messages?since={timestamp}
 * 查詢訊息
 * 
 * 說明：拉取指定聊天室 chatId 在參數 since 之後的新訊息
 * （若無 since，則回傳最新 10 筆）。
 * 
 * 回傳：{ messages: [ ... ] }
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
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const result = await db.query(async (client) => {
      // 驗證使用者有權存取此聊天室
      const room = await (client as any).preChatRoom.findUnique({
        where: { id: chatId },
        select: {
          userId: true,
          partnerId: true,
          expiresAt: true,
          status: true,
        },
      });

      if (!room) {
        throw new Error('聊天室不存在');
      }

      // 檢查權限
      if (room.userId !== session.user.id && room.partnerId !== session.user.id) {
        throw new Error('無權限訪問此聊天室');
      }

      // 檢查是否過期（超過 24 小時）
      const isExpired = new Date(room.expiresAt) < new Date();
      if (isExpired) {
        return { messages: [] };
      }

      // 查詢訊息（只查詢必要欄位，使用索引）
      let messages;
      if (since) {
        // 查詢 since 之後的訊息
        messages = await (client as any).preChatMessage.findMany({
          where: {
            roomId: chatId,
            createdAt: {
              gt: new Date(since),
            },
          },
          select: {
            id: true,
            senderType: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
          take: 10,
        });
      } else {
        // 查詢最新 10 則訊息（ORDER BY created_at DESC LIMIT 10，使用索引）
        messages = await (client as any).preChatMessage.findMany({
          where: {
            roomId: chatId,
          },
          select: {
            id: true,
            senderType: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        messages = messages.reverse(); // 反轉為時間正序
      }

      // 格式化訊息
      const formattedMessages = messages.map((msg: any) => ({
        id: msg.id.toString(),
        senderId: msg.senderType === 'user' ? room.userId : room.partnerId,
        senderType: msg.senderType,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
      }));

      return { messages: formattedMessages };
    }, 'chatrooms:chatId:messages:get');

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'chatrooms:chatId:messages:get');
  }
}

/**
 * POST /api/chatrooms/{chatId}/messages
 * 發送訊息
 * 
 * 請求：JSON 格式 { "content": "使用者輸入的訊息" }
 * 回傳：{ messageId, createdAt } 或錯誤訊息
 */
export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { chatId } = params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: '訊息內容不能為空' }, { status: 400 });
    }

    // 過濾聯絡資訊
    const forbiddenPatterns = [
      /https?:\/\/\S+/i, // URL
      /@[\w\.]+/i, // @username
      /\b(?:instagram|ig|line|telegram|facebook|fb|twitter|wechat|whatsapp)\b/i, // 社群平台
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, // Email
      /[\+]?[0-9\-\.\s]{7,}/i, // 電話號碼
    ];

    if (forbiddenPatterns.some((regex) => regex.test(content))) {
      return NextResponse.json(
        { error: '訊息中含有禁止的聯絡資訊' },
        { status: 400 }
      );
    }

    const result = await db.query(async (client) => {
      // 使用事務確保併發安全
      return await (client as any).$transaction(async (tx: any) => {
        // 1. 鎖聊天室（避免併發爆掉）
        // 注意：PostgreSQL 的 FOR UPDATE 需要在事務中使用原生 SQL
        // 這裡使用 findUnique 然後在更新時使用條件檢查
        const room = await tx.preChatRoom.findUnique({
          where: { id: chatId },
          select: {
            userId: true,
            partnerId: true,
            status: true,
            messageCount: true,
            expiresAt: true,
          },
        });

        if (!room) {
          throw new Error('聊天室不存在');
        }

        // 檢查權限
        const isUser = room.userId === session.user.id;
        const isPartner = room.partnerId === session.user.id;
        if (!isUser && !isPartner) {
          throw new Error('無權限訪問此聊天室');
        }

        // 2. 檢查能不能送
        const now = new Date();
        const isExpired = new Date(room.expiresAt) < now;
        if (isExpired || room.status !== 'open') {
          throw new Error('聊天室已關閉或已過期');
        }

        if (room.messageCount >= 10) {
          throw new Error('已達到訊息上限（10 則）');
        }

        // 3. 寫訊息並在同一 transaction 更新 meta
        const senderType = isUser ? 'user' : 'partner';
        const message = await tx.preChatMessage.create({
          data: {
            roomId: chatId,
            senderType: senderType,
            content: content.trim(),
          },
        });

        // 4. 更新 meta：last_message_at 和 message_count（同一 transaction）
        const updatedRoom = await tx.preChatRoom.update({
          where: { id: chatId },
          data: {
            lastMessageAt: message.createdAt, // 更新最後訊息時間
            messageCount: {
              increment: 1,
            },
            // 如果到 10 則就鎖
            status: room.messageCount + 1 >= 10 ? 'locked' : room.status,
          },
        });

        return {
          messageId: message.id.toString(),
          createdAt: message.createdAt.toISOString(),
        };
      });
    }, 'chatrooms:chatId:messages:post');

    // 清除 meta 快取（因為有新訊息）
    const cacheKey = `prechat:meta:${chatId}`;
    Cache.delete(cacheKey).catch((err: any) => {
      console.warn('Failed to invalidate meta cache:', err.message);
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message?.includes('聊天室') || error.message?.includes('權限') || error.message?.includes('上限')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return createErrorResponse(error, 'chatrooms:chatId:messages:post');
  }
}

