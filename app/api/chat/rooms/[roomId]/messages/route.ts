import { NextResponse } from 'next/server';
import { performance } from 'perf_hooks';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/rooms/[roomId]/messages
 * 獲取聊天室訊息歷史
 * ✅ 關鍵優化：使用 Cache.getOrSet，先查 Redis，MISS 才查 DB
 */
export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const t0 = performance.now();

  try {
    const session = await getServerSession(authOptions);
    const tAuth = performance.now();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { roomId } = params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const cursor = searchParams.get('cursor');

    // ✅ 檢查環境變數
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const redisStatus = (redisUrl && redisToken) ? 'SET' : 'NOT_SET';
    const redisUrlPreview = redisUrl ? `${redisUrl.substring(0, 30)}...` : 'N/A';

    // ✅ 只有最新消息（無 cursor 參數）才使用 Redis List cache
    const useCache = !cursor && redisStatus === 'SET';
    const listKey = useCache ? CacheKeys.chat.messages(roomId) : null;

    // ✅ 使用 Redis List（LRANGE）而不是 SET
    if (listKey) {
      const redisStart = performance.now();
      const cachedMessages = await Cache.listRange<any>(listKey, 0, limit - 1);
      const redisMs = performance.now() - redisStart;

      if (cachedMessages.length > 0) {
        // ✅ Cache HIT：直接返回
        const tEnd = performance.now();
        const totalMs = (tEnd - t0).toFixed(1);
        const authMs = (tAuth - t0).toFixed(1);
        const serverTiming = `auth;dur=${authMs},redis;dur=${redisMs.toFixed(1)},db;dur=0,total;dur=${totalMs}`;

        console.error(`🔥 Redis HIT (List): ${listKey} (${cachedMessages.length} messages) | redis ${redisMs.toFixed(1)}ms | total ${totalMs}ms`);

        return NextResponse.json(
          { messages: cachedMessages, cursor: null },
          {
            status: 200,
            headers: {
              'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
              'X-Cache': 'HIT',
              'X-Redis-Op': 'LRANGE',
              'X-Redis-Status': redisStatus,
              'X-Redis-URL-Preview': redisUrlPreview,
              'X-Redis-Ms': redisMs.toFixed(1),
              'Server-Timing': serverTiming,
              'X-Server-Timing': serverTiming,
              'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Op, X-Redis-Status, X-Redis-URL-Preview, X-Redis-Ms',
            },
          }
        );
      }

      // ❄️ Cache MISS：查 DB 並回填 Redis List
      const dbStart = performance.now();
      try {
        const result = await db.query(async (client) => {
          // 權限驗證
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

          // 查詢訊息
          const messages = await (client as any).$queryRaw`
            SELECT
              id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
            FROM "ChatMessage"
            WHERE "roomId" = ${roomId}
              AND "moderationStatus" != 'REJECTED'
            ORDER BY "createdAt" DESC, id DESC
            LIMIT ${limit}
          `;

          const formattedMessages = (messages as any[]).reverse().map((msg: any) => ({
            id: msg.id,
            roomId: msg.roomId,
            senderId: msg.senderId,
            senderName: msg.senderName || null,
            senderAvatarUrl: msg.senderAvatarUrl || null,
            content: msg.content,
            contentType: 'TEXT' as const,
            status: 'SENT' as const,
            moderationStatus: 'APPROVED' as const,
            createdAt: msg.createdAt,
            sender: {
              id: msg.senderId,
              name: msg.senderName || null,
              email: '',
              role: '',
              avatarUrl: msg.senderAvatarUrl || null,
            },
          }));

          return {
            messages: formattedMessages,
            cursor: null,
          };
        }, 'chat:rooms:roomId:messages:get');

        const dbMs = performance.now() - dbStart;
        const messages = result.messages || [];

        // 🟩 回填 Redis List（背景執行，不阻塞回應）
        if (messages.length > 0) {
          // 清空舊的並回填（從右邊推入，保持時間順序）
          Cache.delete(listKey)
            .then(() => Cache.listPushRight(listKey, ...messages))
            .then(() => Cache.listTrim(listKey, 0, 49)) // 只保留最近 50 則
            .catch((error: any) => {
              console.error(`⚠️ Failed to backfill Redis List for ${listKey}:`, error.message);
            });
        }

        const tEnd = performance.now();
        const totalMs = (tEnd - t0).toFixed(1);
        const authMs = (tAuth - t0).toFixed(1);
        const serverTiming = `auth;dur=${authMs},redis;dur=${redisMs.toFixed(1)},db;dur=${dbMs.toFixed(1)},total;dur=${totalMs}`;

        console.error(`❄️ Redis MISS (List): ${listKey} | redis ${redisMs.toFixed(1)}ms | db ${dbMs.toFixed(1)}ms | total ${totalMs}ms`);

        return NextResponse.json(
          { messages, cursor: null },
          {
            status: 200,
            headers: {
              'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
              'X-Cache': 'MISS',
              'X-Redis-Op': 'LRANGE',
              'X-Redis-Status': redisStatus,
              'X-Redis-URL-Preview': redisUrlPreview,
              'X-Redis-Ms': redisMs.toFixed(1),
              'X-Db-Ms': dbMs.toFixed(1),
              'Server-Timing': serverTiming,
              'X-Server-Timing': serverTiming,
              'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Op, X-Redis-Status, X-Redis-URL-Preview, X-Redis-Ms, X-Db-Ms',
            },
          }
        );
      } catch (error: any) {
        console.error(`⚠️ DB query error:`, error.message);
        // Fall through to DB query below
      }
    }

    // ✅ 沒有 cache key 或 Redis 不可用，直接查 DB
    const dbStart = performance.now();
    const result = await db.query(async (client) => {
      // 權限驗證
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

      // 查詢訊息
      let messages: any[];

      if (cursor) {
        const cursorDate = new Date(cursor);
        messages = await (client as any).$queryRaw`
          SELECT
            id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
          FROM "ChatMessage"
          WHERE "roomId" = ${roomId}
            AND "moderationStatus" != 'REJECTED'
            AND ("createdAt" < ${cursorDate} OR ("createdAt" = ${cursorDate} AND id < ${cursor.split(':')[1] || ''}))
          ORDER BY "createdAt" DESC, id DESC
          LIMIT ${limit}
        `;
      } else {
        messages = await (client as any).$queryRaw`
          SELECT
            id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
          FROM "ChatMessage"
          WHERE "roomId" = ${roomId}
            AND "moderationStatus" != 'REJECTED'
          ORDER BY "createdAt" DESC, id DESC
          LIMIT ${limit}
        `;
      }

      const formattedMessages = (messages as any[]).reverse().map((msg: any) => ({
        id: msg.id,
        roomId: msg.roomId,
        senderId: msg.senderId,
        senderName: msg.senderName || null,
        senderAvatarUrl: msg.senderAvatarUrl || null,
        content: msg.content,
        contentType: 'TEXT' as const,
        status: 'SENT' as const,
        moderationStatus: 'APPROVED' as const,
        createdAt: msg.createdAt,
        sender: {
          id: msg.senderId,
          name: msg.senderName || null,
          email: '',
          role: '',
          avatarUrl: msg.senderAvatarUrl || null,
        },
      }));

      const nextCursor = formattedMessages.length > 0
        ? `${formattedMessages[formattedMessages.length - 1].createdAt}:${formattedMessages[formattedMessages.length - 1].id}`
        : null;

      return {
        messages: formattedMessages,
        cursor: nextCursor,
      };
    }, 'chat:rooms:roomId:messages:get');
    const dbDone = performance.now();
    const dbMs = dbDone - dbStart;

    const messages = (result as any)?.messages || result || [];
    const nextCursor = (result as any)?.cursor || null;
    const tEnd = performance.now();
    const authMs = (tAuth - t0).toFixed(1);
    const dbMsFormatted = dbMs.toFixed(1);
    const totalMs = (tEnd - t0).toFixed(1);
    const serverTiming = `auth;dur=${authMs},redis;dur=0,db;dur=${dbMsFormatted},total;dur=${totalMs}`;
    
    console.error(`[MESSAGES API] ⏱️ FINAL: room=${roomId} auth=${authMs}ms db=${dbMsFormatted}ms total=${totalMs}ms cache=SKIP`);

    return NextResponse.json(
      { messages, cursor: nextCursor },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=3, stale-while-revalidate=5',
          'X-Cache': 'SKIP',
          'X-Redis-Status': redisStatus,
          'X-Redis-URL-Preview': redisUrlPreview,
          'Server-Timing': serverTiming,
          'X-Server-Timing': serverTiming,
          'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Status, X-Redis-URL-Preview',
        },
      }
    );
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:messages:get');
  }
}

/**
 * POST /api/chat/rooms/[roomId]/messages
 * 發送訊息
 * ✅ 關鍵優化：Write-through cache（寫入 DB 後同步更新 Redis List）
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

    // 檢查 Redis 狀態
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const redisStatus = (redisUrl && redisToken) ? 'SET' : 'NOT_SET';

    const result = await db.query(async (client) => {
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

      // 免費聊天限制檢查
      if (isFreeChat) {
        const recentMessages = await (client as any).chatMessage.findMany({
          where: {
            roomId,
            senderId: session.user.id,
          },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        const FREE_CHAT_LIMIT = 5;
        if (recentMessages.length >= FREE_CHAT_LIMIT) {
          throw new Error(`免費聊天句數上限為${FREE_CHAT_LIMIT}句，您已達到上限`);
        }
      }

      // 獲取使用者資訊
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

      const avatarUrl = user?.partner?.coverImage || null;
      const senderName = user?.name || session.user.email || '未知用戶';

      // 內容過濾
      const blockedKeywords = ['垃圾', 'spam'];
      const hasBlockedKeyword = blockedKeywords.some((keyword) =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      // 寫入訊息並更新 ChatRoom.lastMessageAt
      const message = await (client as any).$transaction(async (tx: any) => {
        const newMessage = await tx.chatMessage.create({
          data: {
            roomId,
            senderId: session.user.id,
            senderName: senderName,
            senderAvatarUrl: avatarUrl,
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
          },
        });

        await tx.chatRoom.update({
          where: { id: roomId },
          data: { lastMessageAt: newMessage.createdAt },
        });

        return newMessage;
      });

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
        sender: {
          id: message.senderId,
          name: message.senderName,
          email: '',
          role: '',
          avatarUrl: message.senderAvatarUrl,
        },
      };
    }, 'chat:rooms:roomId:messages:post');

    // ✅ Write-through cache：同步更新 Redis List
    if (redisStatus === 'SET') {
      const listKey = CacheKeys.chat.messages(roomId);
      
      // 格式化訊息（與 GET API 格式一致）
      const formattedMessage = {
        id: result.id,
        roomId: result.roomId,
        senderId: result.senderId,
        senderName: result.senderName || null,
        senderAvatarUrl: result.senderAvatarUrl || null,
        content: result.content,
        contentType: result.contentType || 'TEXT',
        status: result.status || 'SENT',
        moderationStatus: result.moderationStatus || 'APPROVED',
        createdAt: result.createdAt,
        sender: result.sender,
      };

      // 從左邊推入新訊息（最新的在最前面）
      Cache.listPush(listKey, formattedMessage)
        .then(() => Cache.listTrim(listKey, 0, 49)) // 只保留最近 50 則
        .then(() => {
          console.error(`✅ Write-through cache: ${listKey} updated with new message`);
        })
        .catch((error: any) => {
          console.error(`⚠️ Failed to update Redis List for ${listKey}:`, error.message);
        });

      // 同時清除 meta cache（讓 meta polling 知道有新訊息）
      Cache.delete(CacheKeys.chat.meta(roomId)).catch(() => {});
    }

    return NextResponse.json({ message: result });
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:messages:post');
  }
}
