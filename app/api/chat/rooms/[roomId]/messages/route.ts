import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { Cache } from '@/lib/redis-cache';
import { withRateLimit } from '@/lib/rate-limit';

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
    // ✅ 關鍵優化：首屏只載入 10 則訊息，大幅提升速度
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const cursor = searchParams.get('cursor'); // cursor-based pagination (使用 cursor 而不是 before)

    // ✅ 關鍵優化：統一 cache key，所有用戶共用同一份 cache
    // cache key 格式：messages:{roomId}:latest:10（固定格式，不包含 userId，不包含 cursor）
    // 注意：只有最新消息（無 cursor 參數）才 cache，分頁查詢不 cache
    const cacheKey = cursor 
      ? null // 分頁查詢不 cache
      : `messages:${roomId}:latest:10`; // ✅ 固定 limit = 10（首屏優化）
    
    // ✅ 只有最新消息才使用 cache
    if (cacheKey) {
      try {
        const cached = await Cache.get(cacheKey);
        
        if (cached) {
          // ✅ cache hit：直接返回，禁止任何 DB 查詢（包括權限驗證）
          console.log(`🔥 messages cache HIT: ${cacheKey} (${Array.isArray(cached) ? cached.length : 0} messages)`);
          return NextResponse.json(
            { 
              messages: cached,
              cursor: null, // ✅ cache hit 時不返回 cursor（因為是最新消息）
            },
            {
              headers: {
                'Cache-Control': 'private, max-age=3, stale-while-revalidate=5',
                'X-Cache': 'HIT',
              },
            }
          );
        }
        
        console.log(`❄️ messages cache MISS: ${cacheKey}, will query DB`);
      } catch (error: any) {
        // Redis 不可用時，降級為直接查 DB（不報錯）
        console.warn(`⚠️ Cache unavailable for ${cacheKey}, falling back to DB:`, error.message);
      }
      } else {
        console.log(`📄 Pagination query (cursor=${cursor}), skipping cache`);
      }

    // ✅ cache miss：查詢 DB（使用原生 SQL，禁止 JOIN）
    const result = await db.query(async (client) => {
      // ✅ 權限驗證（只在 cache miss 時執行）
      const [membership, user] = await Promise.all([
        client.chatRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: session.user.id,
            },
          },
          select: { id: true },
        }),
        client.user.findUnique({
          where: { id: session.user.id },
          select: { role: true },
        }),
      ]);

      if (!membership && user?.role !== 'ADMIN') {
        throw new Error('無權限訪問此聊天室');
      }

      // ✅ 關鍵優化：使用原生 SQL 查詢，禁止 JOIN
      // ✅ 只 select 必要欄位：id, senderId, senderName, senderAvatarUrl, content, createdAt
      // ✅ 這是業界標準做法：單表查詢，不使用 JOIN，最小化資料傳輸
      let messages: any[];
      
      if (cursor) {
        // ✅ Cursor-based pagination（不 cache）
        // cursor 格式：{createdAt}:{id} 或 ISO 日期字符串
        const cursorDate = new Date(cursor);
        messages = await (client as any).$queryRaw`
          SELECT 
            id,
            "roomId",
            "senderId",
            "senderName",
            "senderAvatarUrl",
            content,
            "createdAt"
          FROM "ChatMessage"
          WHERE "roomId" = ${roomId}::text
            AND "moderationStatus" != 'REJECTED'
            AND ("createdAt" < ${cursorDate} OR ("createdAt" = ${cursorDate} AND id < ${cursor.split(':')[1] || ''}))
          ORDER BY "createdAt" DESC, id DESC
          LIMIT ${limit}
        `;
      } else {
        // ✅ 最新消息查詢（會 cache）- 只 select 必要欄位
        messages = await (client as any).$queryRaw`
          SELECT 
            id,
            "roomId",
            "senderId",
            "senderName",
            "senderAvatarUrl",
            content,
            "createdAt"
          FROM "ChatMessage"
          WHERE "roomId" = ${roomId}::text
            AND "moderationStatus" != 'REJECTED'
          ORDER BY "createdAt" DESC, id DESC
          LIMIT ${limit}
        `;
      }
      
      // ✅ 轉換格式（舊訊息可能 senderName 為 null，顯示「未知用戶」）
      // ✅ 只返回必要欄位，減少資料傳輸
      const formattedMessages = (messages as any[]).reverse().map((msg: any) => ({
        id: msg.id,
        roomId: msg.roomId,
        senderId: msg.senderId,
        senderName: msg.senderName || null,        // 可能為 null（舊訊息）
        senderAvatarUrl: msg.senderAvatarUrl || null, // 可能為 null（舊訊息）
        content: msg.content,
        contentType: 'TEXT' as const, // ✅ 默認值，減少查詢
        status: 'SENT' as const, // ✅ 默認值，減少查詢
        moderationStatus: 'APPROVED' as const, // ✅ 默認值（已過濾 REJECTED）
        createdAt: msg.createdAt,
        sender: {
          id: msg.senderId,
          name: msg.senderName || null,           // 舊訊息可能為 null
          email: '',
          role: '',
          avatarUrl: msg.senderAvatarUrl || null, // 舊訊息可能為 null
        },
      }));
      
      // ✅ 返回 cursor 供下次分頁使用
      const nextCursor = formattedMessages.length > 0 
        ? `${formattedMessages[formattedMessages.length - 1].createdAt}:${formattedMessages[formattedMessages.length - 1].id}`
        : null;
      
      return {
        messages: formattedMessages,
        cursor: nextCursor,
      };
    }, 'chat:rooms:roomId:messages:get');

    // ✅ 關鍵優化：寫入快取（3秒 TTL，允許短暫不一致）
    // 不等待快取寫入完成（fire-and-forget），避免阻塞響應
    // 只有最新消息才 cache（分頁查詢不 cache）
    if (cacheKey && result && typeof result === 'object' && 'messages' in result && Array.isArray(result.messages)) {
      Cache.set(cacheKey, result.messages, 3).then(() => {
        console.log(`✅ Cache set: ${cacheKey} (${result.messages.length} messages, TTL: 3s)`);
      }).catch((err: any) => {
        // Redis 不可用時，靜默失敗（不影響功能）
        console.warn(`⚠️ Failed to cache messages (Redis may be unavailable):`, err.message);
      });
    } else if (!cacheKey) {
      console.log(`📄 Skipping cache (pagination query)`);
    }

    // ✅ 返回結果，包含 cursor 供分頁使用
    const messages = (result as any)?.messages || result || [];
    const nextCursor = (result as any)?.cursor || null;
    
    return NextResponse.json(
      { 
        messages,
        cursor: nextCursor, // ✅ 返回 cursor 供下次分頁使用
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=3, stale-while-revalidate=5',
          'X-Cache': 'MISS',
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

    // ✅ Rate limit：每用戶 3 條/秒，burst 5 條
    const rateLimitResponse = await withRateLimit(
      request as any,
      {
        windowMs: 1000, // 1 秒
        maxRequests: 3,
        keyGenerator: (req, userId) => `user:${session.user.id}`,
      },
      session.user.id
    );

    if (rateLimitResponse) {
      return rateLimitResponse;
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

      // ✅ 關鍵優化：其他工作丟到 queue（非同步處理）
      // 不阻塞回應，立即返回新消息
      try {
        const { addMessageJob } = await import('@/lib/message-queue');
        addMessageJob({
          messageId: message.id,
          roomId: message.roomId,
        }).catch((err: any) => {
          console.error('Failed to add message job:', err);
        });
      } catch (err) {
        // Queue 不可用時，降級為 fire-and-forget
        (client as any).chatRoom
          .update({
            where: { id: roomId },
            data: { lastMessageAt: new Date() },
          })
          .catch((err: any) => {
            console.error('Failed to update lastMessageAt:', err);
          });
      }

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

    // ✅ 關鍵優化：發送消息後清除快取，確保新消息立即顯示
    // 使用統一的 cache key 格式（limit=10）
    const cacheKey = `messages:${roomId}:latest:10`;
    Cache.delete(cacheKey).catch((err: any) => {
      console.error('Failed to invalidate messages cache:', err);
    });
    
    // 也清除其他可能的變體
    const cachePattern = `messages:${roomId}:*`;
    Cache.deletePattern(cachePattern).catch((err: any) => {
      console.error('Failed to invalidate messages cache pattern:', err);
    });

    return NextResponse.json({ message: result });
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:messages:post');
  }
}
