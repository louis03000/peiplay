import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 優化：支援 cursor-based pagination
    const cursor = searchParams.get('cursor');
    const useCursorPagination = cursor || offset > 100;

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (type) {
      where.type = type;
    }

    if (unreadOnly) {
      where.isRead = false;
    }

    const result = await db.query(async (client) => {
      // 優化：使用 cursor-based pagination
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
          console.warn('Invalid cursor format, falling back to offset');
        }
      }

      const [notifications, unreadCount] = await Promise.all([
        client.notification.findMany({
          where: {
            ...where,
            ...cursorCondition,
          },
          select: {
            // 優化：使用 select 只查詢必要欄位
            id: true,
            userId: true,
            title: true,
            content: true,
            type: true,
            isRead: true,
            createdAt: true,
            data: true,
          },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' }, // 確保排序穩定
          ],
          take: limit,
          ...(useCursorPagination ? {} : { skip: offset }),
        }),
        client.notification.count({
          where: {
            userId: session.user.id,
            isRead: false,
          },
        }),
      ]);

      return { notifications, unreadCount };
    }, 'notifications:get');

    // 個人資料使用 private cache
    return NextResponse.json(
      {
        notifications: result.notifications,
        unreadCount: result.unreadCount,
        hasMore: result.notifications.length === limit,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    return createErrorResponse(error, 'notifications:get');
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { type } = await request.json();

    const where: Record<string, unknown> = {
      userId: session.user.id,
      isRead: false,
    };

    if (type) {
      where.type = type;
    }

    await db.query(async (client) => {
      await client.notification.updateMany({
        where,
        data: { isRead: true },
      });
    }, 'notifications:mark-read');

    return NextResponse.json({
      success: true,
      message: '通知已標記為已讀',
    });
  } catch (error) {
    return createErrorResponse(error, 'notifications:mark-read');
  }
}
