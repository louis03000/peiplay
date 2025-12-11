import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/chat
 * 管理員查看所有聊天室和訊息（用於內容審查）
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 驗證管理員權限
    const user = await db.query(
      async (client) =>
        await client.user.findUnique({
          where: { id: session.user.id },
          select: { role: true },
        }),
      'admin:chat:get:user'
    );

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // PENDING, FLAGGED, REJECTED
    const roomId = searchParams.get('roomId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    
    // 優化：支援 cursor-based pagination（避免大偏移量效能問題）
    const cursor = searchParams.get('cursor'); // JSON: {createdAt: '...', id: '...'}
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 如果 offset > 100，建議使用 cursor pagination
    const useCursorPagination = cursor || offset > 100;

    const result = await db.query(async (client) => {
      const where: any = {};

      if (status) {
        where.moderationStatus = status;
      }

      if (roomId) {
        where.roomId = roomId;
      }

      // 優化：使用 cursor-based pagination 避免大偏移量效能問題
      let cursorCondition: any = {};
      if (useCursorPagination && cursor) {
        try {
          const cursorData = JSON.parse(cursor);
          cursorCondition = {
            OR: [
              { createdAt: { lt: new Date(cursorData.createdAt) } },
              {
                createdAt: new Date(cursorData.createdAt),
                id: { lt: cursorData.id },
              },
            ],
          };
        } catch (e) {
          // 如果 cursor 格式錯誤，回退到 offset
          console.warn('Invalid cursor format, falling back to offset');
        }
      }

      // 獲取需要審查的訊息
      const messages = await client.chatMessage.findMany({
        where: {
          ...where,
          ...cursorCondition,
          OR: [
            { moderationStatus: 'FLAGGED' },
            { moderationStatus: 'PENDING' },
            { moderationStatus: 'REJECTED' },
          ],
        },
        select: {
          // 優化：使用 select 而非 include，只查詢必要欄位
          id: true,
          content: true,
          moderationStatus: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          room: {
            select: {
              id: true,
              members: {
                select: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              booking: {
                select: {
                  id: true,
                  orderNumber: true,
                },
              },
              groupBooking: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' }, // 確保排序穩定
        ],
        take: limit,
        ...(useCursorPagination ? {} : { skip: offset }), // 僅在非 cursor pagination 時使用 skip
      });

      // 獲取統計資訊
      const stats = {
        pending: await client.chatMessage.count({
          where: { moderationStatus: 'PENDING' },
        }),
        flagged: await client.chatMessage.count({
          where: { moderationStatus: 'FLAGGED' },
        }),
        rejected: await client.chatMessage.count({
          where: { moderationStatus: 'REJECTED' },
        }),
      };

      return { messages, stats };
    }, 'admin:chat:get');

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'admin:chat:get');
  }
}

/**
 * PATCH /api/admin/chat
 * 管理員審查訊息（批准/拒絕）
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 驗證管理員權限
    const user = await db.query(
      async (client) =>
        await client.user.findUnique({
          where: { id: session.user.id },
          select: { role: true },
        }),
      'admin:chat:patch:user'
    );

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const body = await request.json();
    const { messageId, action, reason } = body; // action: 'approve' | 'reject'

    if (!messageId || !action) {
      return NextResponse.json(
        { error: '缺少必要參數' },
        { status: 400 }
      );
    }

    const result = await db.query(async (client) => {
      const moderationStatus =
        action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : null;

      if (!moderationStatus) {
        throw new Error('無效的操作');
      }

      const message = await client.chatMessage.update({
        where: { id: messageId },
        data: {
          moderationStatus,
          moderationReason: reason || null,
        },
      });

      return { message };
    }, 'admin:chat:patch');

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'admin:chat:patch');
  }
}

