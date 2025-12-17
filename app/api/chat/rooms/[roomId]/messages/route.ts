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

    // ✅ 只有最新消息（無 cursor 參數，limit <= 10）才使用 cache
    const cacheKey = cursor || limit > 10
      ? null
      : CacheKeys.chat.messages(roomId, limit);

    // ✅ 如果有 cache key，使用 Cache.getOrSet（這行是關鍵！）
    if (cacheKey && redisStatus === 'SET') {
      // 🟥 先單獨測量 Redis get 時間（不包含 factory）
      const redisGetStart = performance.now();
      const cached = await Cache.get<any[]>(cacheKey);
      const redisGetMs = performance.now() - redisGetStart;
      
      if (cached && Array.isArray(cached) && cached.length > 0) {
        // ✅ Cache HIT：直接返回
        const tEnd = performance.now();
        const totalMs = (tEnd - t0).toFixed(1);
        const authMs = (tAuth - t0).toFixed(1);
        const serverTiming = `auth;dur=${authMs},redis;dur=${redisGetMs.toFixed(1)},db;dur=0,total;dur=${totalMs}`;
        
        console.error(`🔥 Redis HIT: ${cacheKey} (${cached.length} messages) | redis ${redisGetMs.toFixed(1)}ms | total ${totalMs}ms`);

        return NextResponse.json(
          { messages: cached, cursor: null },
          {
            status: 200,
            headers: {
              'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
              'X-Cache': 'HIT',
              'X-Redis-Status': redisStatus,
              'X-Redis-URL-Preview': redisUrlPreview,
              'X-Redis-Ms': redisGetMs.toFixed(1),
              'Server-Timing': serverTiming,
              'X-Server-Timing': serverTiming,
              'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Status, X-Redis-URL-Preview, X-Redis-Ms',
            },
          }
        );
      }

      // ❄️ Cache MISS：查 DB
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

        // 🟩 寫回 Redis（不等待完成，避免阻塞）
        Cache.set(cacheKey, messages, CacheTTL.SHORT).catch((error: any) => {
          console.error(`⚠️ Failed to set cache for ${cacheKey}:`, error.message);
        });

        const tEnd = performance.now();
        const totalMs = (tEnd - t0).toFixed(1);
        const authMs = (tAuth - t0).toFixed(1);
        const serverTiming = `auth;dur=${authMs},redis;dur=${redisGetMs.toFixed(1)},db;dur=${dbMs.toFixed(1)},total;dur=${totalMs}`;
        
        console.error(`❄️ Redis MISS: ${cacheKey} | redis get ${redisGetMs.toFixed(1)}ms | db ${dbMs.toFixed(1)}ms | total ${totalMs}ms`);

        return NextResponse.json(
          { messages, cursor: null },
          {
            status: 200,
            headers: {
              'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
              'X-Cache': 'MISS',
              'X-Redis-Status': redisStatus,
              'X-Redis-URL-Preview': redisUrlPreview,
              'X-Redis-Ms': redisGetMs.toFixed(1),
              'X-Db-Ms': dbMs.toFixed(1),
              'Server-Timing': serverTiming,
              'X-Server-Timing': serverTiming,
              'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Status, X-Redis-URL-Preview, X-Redis-Ms, X-Db-Ms',
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
