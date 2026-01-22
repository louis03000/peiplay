import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { Cache } from '@/lib/redis-cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/unread-count
 * 獲取用戶的未讀消息總數（用於導航欄紅點提示）
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ unreadCount: 0 }, { status: 200 });
    }

    // ✅ Redis 快取（5 秒 TTL，因為需要實時性）
    const cacheKey = `chat:unread-count:${session.user.id}`;
    try {
      const cached = await Cache.get(cacheKey);
      if (cached !== null) {
        return NextResponse.json(
          { unreadCount: cached },
          {
            headers: {
              'X-Cache': 'HIT',
              'Cache-Control': 'private, max-age=5, stale-while-revalidate=10',
            },
          }
        );
      }
    } catch (err: any) {
      // Redis 不可用時，降級為直接查 DB
      console.warn('Cache unavailable, falling back to DB:', err.message);
    }

    const result = await db.query(async (client) => {
      // 獲取用戶的所有活躍聊天室成員關係
      const memberships = await (client as any).chatRoomMember.findMany({
        where: {
          userId: session.user.id,
          isActive: true,
        },
        select: {
          roomId: true,
          lastReadAt: true,
        },
      });

      if (memberships.length === 0) {
        return 0;
      }

      if (memberships.length === 0) {
        return 0;
      }

      const roomIds = memberships.map((m: any) => m.roomId);
      const lastReadMap = new Map<string, Date | null>();
      memberships.forEach((m: any) => {
        lastReadMap.set(m.roomId, m.lastReadAt);
      });

      // ✅ 優化：使用單一查詢計算所有未讀消息（更高效）
      // 查詢所有未讀消息（沒有已讀回條的消息）
      const unreadMessages = await (client as any).chatMessage.findMany({
        where: {
          roomId: { in: roomIds },
          senderId: { not: session.user.id }, // 只計算別人發送的消息
          moderationStatus: { not: 'REJECTED' }, // 排除被拒絕的消息
          readReceipts: {
            none: {
              userId: session.user.id,
            },
          },
        },
        select: {
          id: true,
          roomId: true,
          createdAt: true,
        },
      });

      // 過濾：如果用戶有 lastReadAt，只計算之後的消息
      const filteredUnread = unreadMessages.filter((msg: any) => {
        const lastReadAt = lastReadMap.get(msg.roomId);
        if (!lastReadAt) {
          return true; // 沒有 lastReadAt，所有消息都算未讀
        }
        return new Date(msg.createdAt) > lastReadAt;
      });

      return filteredUnread.length;
    }, 'chat:unread-count:get');

    // ✅ 寫入快取（5 秒 TTL）
    try {
      await Cache.set(cacheKey, result, 5);
    } catch (err: any) {
      // Redis 不可用時，靜默失敗
      console.warn('Failed to cache unread count:', err.message);
    }

    return NextResponse.json(
      { unreadCount: result },
      {
        headers: {
          'Cache-Control': 'private, max-age=5, stale-while-revalidate=10',
          'X-Cache': 'MISS',
        },
      }
    );
  } catch (error) {
    console.error('Error getting unread count:', error);
    // 發生錯誤時返回 0，不阻塞 UI
    return NextResponse.json({ unreadCount: 0 }, { status: 200 });
  }
}
