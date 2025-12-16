import { NextResponse } from 'next/server';
import { performance } from 'perf_hooks';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/rooms/[roomId]/messages
 * 獲取聊天室訊息歷史
 * ✅ 關鍵優化：先查 Redis，MISS 才查 DB
 */
export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const start = Date.now();
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
      : `chat:room:${roomId}:messages:${limit}`;

    // 🟥 1. 先問 Redis（一定要在 DB 之前）
    let cacheStatus = 'SKIP';
    let redisMs = 0;
    
    if (cacheKey && redisStatus === 'SET') {
      try {
        const redisStart = performance.now();
        const cached = await redis.get(cacheKey);
        redisMs = performance.now() - redisStart;

        if (cached && Array.isArray(cached) && cached.length > 0) {
          cacheStatus = 'HIT';
          const tEnd = performance.now();
          const totalMs = (tEnd - t0).toFixed(1);
          const serverTiming = `auth;dur=${(tAuth - t0).toFixed(1)},redis;dur=${redisMs.toFixed(1)},db;dur=0,total;dur=${totalMs}`;
          
          console.error(`🔥 Redis HIT: ${cacheKey} (${cached.length} messages) | redis ${redisMs.toFixed(1)}ms | total ${totalMs}ms`);

          return NextResponse.json(
            { messages: cached, cursor: null },
            {
              status: 200,
              headers: {
                'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
                'X-Cache': 'HIT',
                'X-Redis-Status': redisStatus,
                'X-Redis-URL-Preview': redisUrlPreview,
                'X-Redis-Ms': redisMs.toFixed(1),
                'Server-Timing': serverTiming,
                'X-Server-Timing': serverTiming,
                'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Status, X-Redis-URL-Preview, X-Redis-Ms',
              },
            }
          );
        }

        cacheStatus = 'MISS';
        console.error(`❄️ Redis MISS: ${cacheKey} | redis ${redisMs.toFixed(1)}ms`);
      } catch (error: any) {
        cacheStatus = 'ERROR';
        console.error(`⚠️ Redis error for ${cacheKey}:`, error.message);
      }
    } else if (!cacheKey) {
      cacheStatus = 'SKIP';
      console.error(`📄 Skipping cache (cursor=${cursor || 'none'}, limit=${limit})`);
    } else {
      cacheStatus = 'NOT_SET';
      console.error(`⚠️ Redis env vars not set, skipping cache`);
    }

    // 🟧 2. Redis 沒有，才打 DB
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

    // 🟩 3. 存回 Redis（只有最新消息才 cache）
    if (cacheKey && cacheStatus !== 'ERROR' && redisStatus === 'SET') {
      try {
        await redis.set(cacheKey, result.messages, { ex: 60 });
        console.error(`✅ Redis set: ${cacheKey} (${result.messages.length} messages, TTL: 60s)`);
      } catch (error: any) {
        console.error(`⚠️ Redis set error for ${cacheKey}:`, error.message);
      }
    }

    const messages = (result as any)?.messages || result || [];
    const nextCursor = (result as any)?.cursor || null;
    const tEnd = performance.now();
    const authMs = (tAuth - t0).toFixed(1);
    const dbMsFormatted = dbMs.toFixed(1);
    const totalMs = (tEnd - t0).toFixed(1);
    const serverTiming = `auth;dur=${authMs},redis;dur=${redisMs.toFixed(1)},db;dur=${dbMsFormatted},total;dur=${totalMs}`;
    
    console.error(`[MESSAGES API] ⏱️ FINAL: room=${roomId} auth=${authMs}ms redis=${redisMs.toFixed(1)}ms db=${dbMsFormatted}ms total=${totalMs}ms cache=${cacheStatus}`);

    return NextResponse.json(
      { messages, cursor: nextCursor },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=3, stale-while-revalidate=5',
          'X-Cache': cacheStatus,
          'X-Redis-Status': redisStatus,
          'X-Redis-URL-Preview': redisUrlPreview,
          'X-Redis-Ms': redisMs.toFixed(1),
          'X-Db-Ms': dbMsFormatted,
          'Server-Timing': serverTiming,
          'X-Server-Timing': serverTiming,
          'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Status, X-Redis-URL-Preview, X-Redis-Ms, X-Db-Ms',
        },
      }
    );
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:messages:get');
  }
}
