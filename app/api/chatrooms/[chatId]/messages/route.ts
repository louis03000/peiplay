import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { Cache } from '@/lib/redis-cache';
import { getOrCreateChatRoomForPreChat } from '@/lib/chat-helpers';
import { PrismaClient } from '@prisma/client';

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
  { params }: { params: Promise<{ chatId: string }> | { chatId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { chatId } = resolvedParams;
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

      // ✅ 統一數據源：同時從 ChatMessage 和 PreChatMessage 讀取
      // 1. 獲取或創建對應的 ChatRoom
      const chatRoomResult = await getOrCreateChatRoomForPreChat(
        client,
        room.userId,
        room.partnerId
      );

      // 2. 從 ChatMessage 讀取（主要數據源）
      let chatMessages: any[] = [];
      if (chatRoomResult?.roomId) {
        try {
          if (since) {
            chatMessages = await (client as any).chatMessage.findMany({
              where: {
                roomId: chatRoomResult.roomId,
                createdAt: {
                  gt: new Date(since),
                },
              },
              select: {
                id: true,
                senderId: true,
                senderName: true,
                senderAvatarUrl: true,
                content: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'asc' },
              take: 10,
            });
          } else {
            chatMessages = await (client as any).chatMessage.findMany({
              where: {
                roomId: chatRoomResult.roomId,
              },
              select: {
                id: true,
                senderId: true,
                senderName: true,
                senderAvatarUrl: true,
                content: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 10,
            });
            chatMessages = chatMessages.reverse(); // 反轉為時間正序
          }
        } catch (error) {
          console.error('Failed to load ChatMessages (falling back to PreChatMessages):', error);
        }
      }

      // 3. 如果 ChatMessage 有數據，使用它；否則回退到 PreChatMessage（向後兼容）
      let messages: any[] = [];
      if (chatMessages.length > 0) {
        // 使用 ChatMessage（統一數據源）
        messages = chatMessages.map((msg: any) => ({
          id: msg.id,
          senderId: msg.senderId,
          senderType: msg.senderId === room.userId ? 'user' : 'partner',
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
        }));
      } else {
        // 回退到 PreChatMessage（向後兼容舊數據）
        if (since) {
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

        // 格式化 PreChatMessage
        messages = messages.map((msg: any) => ({
          id: msg.id.toString(),
          senderId: msg.senderType === 'user' ? room.userId : room.partnerId,
          senderType: msg.senderType,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
        }));
      }

      return { messages };
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
  { params }: { params: Promise<{ chatId: string }> | { chatId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { chatId } = resolvedParams;
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

        // 3. 獲取或創建對應的 ChatRoom（統一數據源）
        const chatRoomResult = await getOrCreateChatRoomForPreChat(
          tx,
          room.userId,
          room.partnerId
        );
        
        // 4. 獲取發送者信息（用於 ChatMessage 的 denormalized 字段）
        const sender = await tx.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            partner: {
              select: {
                coverImage: true,
              },
            },
          },
        });

        // 5. 寫訊息到 PreChatMessage（保持向後兼容）
        const senderType = isUser ? 'user' : 'partner';
        const preChatMessage = await tx.preChatMessage.create({
          data: {
            roomId: chatId,
            senderType: senderType,
            content: content.trim(),
          },
        });

        // 6. 同時寫入 ChatMessage（統一數據源）
        let chatMessage = null;
        if (chatRoomResult?.roomId) {
          try {
            chatMessage = await tx.chatMessage.create({
              data: {
                roomId: chatRoomResult.roomId,
                senderId: session.user.id,
                senderName: sender?.name || null,
                senderAvatarUrl: sender?.partner?.coverImage || null,
                content: content.trim(),
                contentType: 'TEXT',
                status: 'SENT',
                moderationStatus: 'APPROVED', // 預聊訊息直接通過審查
              },
            });
            
            // 更新 ChatRoom 的 lastMessageAt
            await tx.chatRoom.update({
              where: { id: chatRoomResult.roomId },
              data: {
                lastMessageAt: chatMessage.createdAt,
              },
            });
          } catch (chatError) {
            // 如果 ChatMessage 創建失敗，記錄錯誤但不影響 PreChatMessage
            console.error('Failed to create ChatMessage (non-fatal):', chatError);
          }
        }

        // 7. 更新 PreChatRoom meta：last_message_at 和 message_count（同一 transaction）
        const updatedRoom = await tx.preChatRoom.update({
          where: { id: chatId },
          data: {
            lastMessageAt: preChatMessage.createdAt, // 更新最後訊息時間
            messageCount: {
              increment: 1,
            },
            // 如果到 10 則就鎖
            status: room.messageCount + 1 >= 10 ? 'locked' : room.status,
          },
        });

        return {
          messageId: preChatMessage.id.toString(),
          createdAt: preChatMessage.createdAt.toISOString(),
          chatMessageId: chatMessage?.id || null, // 返回 ChatMessage ID（如果創建成功）
        };
      });
    }, 'chatrooms:chatId:messages:post');

    // 清除 meta 快取（因為有新訊息）
    const cacheKey = `prechat:meta:${chatId}`;
    try {
      await Cache.delete(cacheKey);
    } catch (err: any) {
      // Redis 不可用時，靜默失敗（不影響功能）
      console.warn('Failed to invalidate meta cache:', err?.message || err);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message?.includes('聊天室') || error.message?.includes('權限') || error.message?.includes('上限')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return createErrorResponse(error, 'chatrooms:chatId:messages:post');
  }
}

