import { NextResponse } from 'next/server';
import { performance } from 'perf_hooks';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { Cache, CacheKeys } from '@/lib/redis-cache';
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
  const start = Date.now();
  console.error('[messages] start', start, 'roomId:', params.roomId);
  
  // ✅ 檢查環境變數（立即顯示在 Vercel Logs 和 Response Headers）
  const redisUrl = process.env.REDIS_URL;
  const redisStatus = redisUrl ? 'SET' : 'NOT_SET';
  const redisUrlPreview = redisUrl ? `${redisUrl.substring(0, 20)}...` : 'N/A';
  
  if (!redisUrl) {
    console.error('❌ REDIS_URL environment variable is NOT SET in Vercel');
  } else {
    console.error(`✅ REDIS_URL is set (length: ${redisUrl.length}, starts with: ${redisUrlPreview})`);
  }

  try {
    const t0 = performance.now();
    const session = await getServerSession(authOptions);
    const tAuth = performance.now();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { roomId } = params;
    const { searchParams } = new URL(request.url);
    // ✅ 關鍵優化：首屏只載入 10 則訊息，大幅提升速度
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const cursor = searchParams.get('cursor'); // cursor-based pagination (使用 cursor 而不是 before)

    // ✅ 關鍵優化：聊天讀取層抽離 Postgres
    // 只有最新消息（無 cursor 參數，limit <= 10）才使用 KV cache
    // TTL = 60 秒（polling 情境，即使失效也只是回 DB 一次）
    const cacheKey = cursor || limit > 10
      ? null // 分頁查詢或 limit > 10 不 cache
      : CacheKeys.chat.messages(roomId, limit); // ✅ 統一使用 CacheKeys
    
    // ✅ 優先從 KV 讀取（命中直接返回，< 50ms）
    let cacheStatus = 'SKIP';
    if (cacheKey) {
      try {
        console.error(`[CACHE] Attempting to get cache: ${cacheKey}`);
        const cached = await Cache.get<any[]>(cacheKey);
        console.error(`[CACHE] Cache.get result:`, cached ? `HIT (${cached.length} items)` : 'MISS');
        
        if (cached && Array.isArray(cached)) {
          cacheStatus = 'HIT';
          // ✅ cache hit：直接返回，禁止任何 DB 查詢（包括權限驗證）
          const tEnd = performance.now();
          const totalMs = (tEnd - t0).toFixed(1);
          const serverTiming = `auth;dur=0,db;dur=0,total;dur=${totalMs}`;
          console.info(
            `🔥 KV cache HIT: ${cacheKey} (${cached.length} messages) | total ${totalMs}ms`
          );
          
          const response = NextResponse.json(
            { messages: cached, cursor: null },
            {
              status: 200,
              headers: {
                'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
                'X-Cache': 'HIT',
                'X-Source': 'kv',
                'X-Redis-Status': redisStatus, // ✅ 顯示 Redis 狀態
                'X-Redis-URL-Preview': redisUrlPreview, // ✅ 顯示 Redis URL 預覽
                'Server-Timing': serverTiming,
                'X-Server-Timing': serverTiming,
                'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Source, X-Redis-Status, X-Redis-URL-Preview',
              },
            }
          );
          
          console.log('[messages] end', Date.now() - start, 'ms (KV HIT)');
          return response;
        }
        
        cacheStatus = 'MISS';
        console.error(`❄️ KV cache MISS: ${cacheKey}, will query DB`);
      } catch (error: any) {
        // Redis/KV 不可用時，降級為直接查 DB（不報錯）
        cacheStatus = 'ERROR';
        console.error(`⚠️ KV unavailable for ${cacheKey}, falling back to DB:`, error.message);
        console.error(`⚠️ KV error details:`, error);
      }
    } else {
      console.info(`📄 Skipping cache (cursor=${cursor || 'none'}, limit=${limit})`);
    }

    // ✅ cache miss：查詢 DB（使用原生 SQL，禁止 JOIN）
    const tDbStart = performance.now();
    const result = await db.query(async (client) => {
      // ✅ 權限驗證（只在 cache miss 時執行）
      const tAuthCheckStart = performance.now();
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
      const tAuthCheckDone = performance.now();
      const authCheckMs = (tAuthCheckDone - tAuthCheckStart).toFixed(1);
      console.log(`[MESSAGES API] 🔐 Auth check: ${authCheckMs}ms (membership: ${membership ? 'found' : 'not found'}, role: ${user?.role || 'none'})`);

      if (!membership && user?.role !== 'ADMIN') {
        throw new Error('無權限訪問此聊天室');
      }

      // ✅ 關鍵優化：使用原生 SQL 查詢，禁止 JOIN
      // ✅ 只 select 必要欄位：id, senderId, senderName, senderAvatarUrl, content, createdAt
      // ✅ 這是業界標準做法：單表查詢，不使用 JOIN，最小化資料傳輸
      let messages: any[];
      
      const tQueryStart = performance.now();
      console.log(`[MESSAGES API] 📊 Starting messages query for room=${roomId}, limit=${limit}, cursor=${cursor || 'none'}`);
      if (cursor) {
        // ✅ Cursor-based pagination（不 cache）
        // cursor 格式：{createdAt}:{id} 或 ISO 日期字符串
        const cursorDate = new Date(cursor);
        // ✅ 關鍵修復：移除 ::text cast，確保使用索引
        // roomId 已經是 TEXT 類型，不需要 cast
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
          WHERE "roomId" = ${roomId}
            AND "moderationStatus" != 'REJECTED'
            AND ("createdAt" < ${cursorDate} OR ("createdAt" = ${cursorDate} AND id < ${cursor.split(':')[1] || ''}))
          ORDER BY "createdAt" DESC, id DESC
          LIMIT ${limit}
        `;
      } else {
        // ✅ 最新消息查詢（會 cache）- 只 select 必要欄位
        // ✅ 關鍵優化：使用部分索引 ChatMessage_roomId_createdAt_not_rejected_idx
        // 這個索引專門用於 moderationStatus != 'REJECTED' 的查詢
        // ✅ 關鍵修復：移除 ::text cast，確保使用索引
        // roomId 已經是 TEXT 類型，不需要 cast
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
          WHERE "roomId" = ${roomId}
            AND "moderationStatus" != 'REJECTED'
          ORDER BY "createdAt" DESC, id DESC
          LIMIT ${limit}
        `;
      }
      const tQueryDone = performance.now();
      const queryMs = (tQueryDone - tQueryStart).toFixed(1);
      console.log(`[MESSAGES API] 📊 Messages query: ${queryMs}ms (found ${messages.length} messages)`);
      
      // ✅ 轉換格式（舊訊息可能 senderName 為 null，顯示「未知用戶」）
      // ✅ 極簡 payload：只返回必要欄位，減少資料傳輸
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
        // ✅ 保持向後兼容的 sender 結構（但前端應該優先使用 senderName/senderAvatarUrl）
        sender: {
          id: msg.senderId,
          name: msg.senderName || null,           // 舊訊息可能為 null
          email: '',                              // ✅ 不傳輸 email（不需要）
          role: '',                               // ✅ 不傳輸 role（不需要）
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
    const tDbDone = performance.now();

    // ✅ 關鍵優化：寫入 KV（60秒 TTL，polling 情境）
    // 不等待快取寫入完成（fire-and-forget），避免阻塞響應
    // 只有最新消息才 cache（分頁查詢不 cache）
    if (cacheKey && result && typeof result === 'object' && 'messages' in result && Array.isArray(result.messages)) {
      console.error(`📝 Attempting to cache: ${cacheKey} (${result.messages.length} messages)`);
      Cache.set(cacheKey, result.messages, 60).then((success) => {
        if (success) {
          console.error(`✅ KV cache set: ${cacheKey} (${result.messages.length} messages, TTL: 60s)`);
        } else {
          console.error(`⚠️ KV cache set failed: ${cacheKey} (Redis client may not be available)`);
        }
      }).catch((err: any) => {
        // Redis/KV 不可用時，靜默失敗（不影響功能）
        console.error(`❌ Failed to cache messages (KV may be unavailable):`, err);
        console.error(`❌ Error details:`, err.message, err.stack);
      });
    } else if (!cacheKey) {
      console.log(`📄 Skipping cache (pagination or limit > 10)`);
    }

    // ✅ 返回結果，包含 cursor 供分頁使用
    const messages = (result as any)?.messages || result || [];
    const nextCursor = (result as any)?.cursor || null;
    const tEnd = performance.now();
    const authMs = (tAuth - t0).toFixed(1);
    const dbMs = (tDbDone - tAuth).toFixed(1);
    const totalMs = (tEnd - t0).toFixed(1);
    const serverTiming = `auth;dur=${authMs},db;dur=${dbMs},total;dur=${totalMs}`;
    console.log(`[MESSAGES API] ⏱️ FINAL TIMING: room=${roomId} auth=${authMs}ms db=${dbMs}ms total=${totalMs}ms cache=${cacheKey ? 'MISS' : 'SKIP'}`);
    console.log(`[MESSAGES API] 📊 Server-Timing header: ${serverTiming}`);
    console.log(`[MESSAGES API] 🔍 DB breakdown: db.query() took ${dbMs}ms (this includes auth check + messages query)`);
    
    const response = NextResponse.json(
      { messages, cursor: nextCursor },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=3, stale-while-revalidate=5',
          'X-Cache': cacheStatus, // ✅ 顯示 cache 狀態（HIT, MISS, SKIP, ERROR）
          'X-Redis-Status': redisStatus, // ✅ 顯示 Redis 狀態（SET 或 NOT_SET）
          'X-Redis-URL-Preview': redisUrlPreview, // ✅ 顯示 Redis URL 預覽
          'Server-Timing': serverTiming,
          'X-Server-Timing': serverTiming, // ✅ 備用方案：Vercel 可能過濾 Server-Timing
          'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Status, X-Redis-URL-Preview',
        },
      }
    );
    
    // ✅ 驗證 header 是否正確設置
    const actualServerTiming = response.headers.get('Server-Timing');
    const actualXServerTiming = response.headers.get('X-Server-Timing');
    console.log(`[MESSAGES API] 📊 Cache MISS - Headers: Server-Timing=${actualServerTiming || 'MISS'}, X-Server-Timing=${actualXServerTiming || 'MISS'}`);
    console.log(`[MESSAGES API] ⏱️ Timing breakdown: auth=${authMs}ms, db=${dbMs}ms, total=${totalMs}ms`);
    console.log('[messages] end', Date.now() - start, 'ms');
    
    return response;
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

      // ✅ 關鍵優化：在同一 transaction 中插入訊息並更新 room 的 lastMessageAt
      // 這確保原子性，避免 race condition
      const message = await (client as any).$transaction(async (tx: any) => {
        // 1. 創建訊息並寫入 denormalized 字段
        const newMessage = await tx.chatMessage.create({
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

        // 2. 在同一 transaction 中更新 room 的 lastMessageAt
        await tx.chatRoom.update({
          where: { id: roomId },
          data: { lastMessageAt: newMessage.createdAt },
        });

        return newMessage;
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
        // Queue 不可用時，靜默失敗（room 已更新）
        console.warn('Message queue unavailable, room already updated');
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

    // ✅ 關鍵優化：發送消息後同步更新 KV（而不是刪除）
    // 這樣可以讓新消息立即顯示，而不需要等待下次 DB 查詢
    const messagesCacheKey = CacheKeys.chat.messages(roomId, 10);
    
    // 從 KV 獲取現有 messages（如果有）
    try {
      const cachedMessages = await Cache.get<any[]>(messagesCacheKey) || [];
      
      // 格式化新訊息（與 GET API 格式一致）
      const newMessageFormatted = {
        id: result.id,
        roomId: result.roomId,
        senderId: result.senderId,
        senderName: result.senderName || null,
        senderAvatarUrl: result.senderAvatarUrl || null,
        content: result.content,
        contentType: result.contentType || 'TEXT',
        status: result.status || 'SENT',
        moderationStatus: result.moderationStatus || 'APPROVED',
        createdAt: typeof result.createdAt === 'string' ? result.createdAt : result.createdAt.toISOString(),
        sender: result.sender || {
          id: result.senderId,
          name: result.senderName || null,
          email: '',
          role: '',
          avatarUrl: result.senderAvatarUrl || null,
        },
      };
      
      // 將新訊息 unshift 到陣列開頭，並只保留最新 10 則
      const updatedMessages = [newMessageFormatted, ...cachedMessages].slice(0, 10);
      
      // 同步更新 KV（重設 TTL = 60 秒）
      await Cache.set(messagesCacheKey, updatedMessages, 60);
      console.log(`✅ KV cache updated: ${messagesCacheKey} (${updatedMessages.length} messages, TTL: 60s)`);
    } catch (err: any) {
      // KV 不可用時，刪除 cache（讓下次查詢回 DB）
      console.warn('Failed to update KV cache, deleting instead:', err.message);
      await Cache.delete(messagesCacheKey).catch(() => {});
    }
    
    // 清除 meta cache（因為 lastMessageAt 已更新）
    const metaCacheKey = CacheKeys.chat.meta(roomId);
    Cache.delete(metaCacheKey).catch((err: any) => {
      console.warn('Failed to invalidate meta cache:', err);
    });

    return NextResponse.json({ message: result });
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:messages:post');
  }
}
