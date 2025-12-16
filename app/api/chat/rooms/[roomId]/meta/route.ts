import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { Cache, CacheKeys } from '@/lib/redis-cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/rooms/[roomId]/meta
 * 獲取聊天室 metadata（極快，只查 ChatRoom 表）
 * 
 * 用途：meta-first polling
 * - 前端先查 meta，只有當 lastMessageAt 改變時才查完整訊息
 * - 大幅減少 DB 查詢和網路傳輸
 */
export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const start = Date.now();
  console.log('[meta] start', start, 'roomId:', params.roomId);
  
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { roomId } = params;

    // ✅ Redis 快取（1 秒 TTL，因為 polling 頻繁）
    const cacheKey = CacheKeys.chat.meta(roomId);
    try {
      const cached = await Cache.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
          },
        });
      }
    } catch (err: any) {
      // Redis 不可用時，降級為直接查 DB
      console.warn('Cache unavailable, falling back to DB:', err.message);
    }

    const result = await db.query(async (client) => {
      // ✅ 權限驗證（並行查詢）
      const [membership, room] = await Promise.all([
        (client as any).chatRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: session.user.id,
            },
          },
          select: { id: true },
        }),
        (client as any).chatRoom.findUnique({
          where: { id: roomId },
          select: {
            id: true,
            lastMessageAt: true,
            type: true,
            bookingId: true,
            groupBookingId: true,
            multiPlayerBookingId: true,
          },
        }),
      ]);

      if (!room) {
        throw new Error('聊天室不存在');
      }

      if (!membership && session.user.role !== 'ADMIN') {
        throw new Error('無權限訪問此聊天室');
      }

      // ✅ 計算未讀數（使用 lastReadAt，如果有的話）
      // 暫時跳過未讀數計算（太慢），前端可以從 messages 計算
      const unreadCount = 0;

      // ✅ 判斷是否為免費聊天室
      const isFreeChat =
        !room.bookingId && !room.groupBookingId && !room.multiPlayerBookingId;

      // ✅ 返回極簡 meta
      return {
        lastMessageAt: room.lastMessageAt?.toISOString() || null,
        unreadCount,
        isFreeChat,
        type: room.type,
      };
    }, 'chat:rooms:roomId:meta:get');

    // ✅ 寫入快取（1 秒 TTL）
    try {
      await Cache.set(cacheKey, result, 1);
    } catch (err: any) {
      // Redis 不可用時，靜默失敗
      console.warn('Failed to cache meta:', err.message);
    }

    console.log('[meta] end', Date.now() - start, 'ms');

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:meta:get');
  }
}

