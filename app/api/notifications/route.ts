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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

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
      const [notifications, unreadCount] = await Promise.all([
        client.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
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

    return NextResponse.json({
      notifications: result.notifications,
      unreadCount: result.unreadCount,
      hasMore: result.notifications.length === limit,
    });
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
