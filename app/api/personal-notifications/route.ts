import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取當前用戶的個人通知
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const notifications = await db.query(async (client) => {
      const now = new Date();
      
      // 優化：限制載入數量，只載入最近的 50 筆通知
      // 使用索引優化的查詢：userId + isRead, userId + isImportant
      return client.personalNotification.findMany({
        where: {
          userId: session.user.id,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } }
          ],
        },
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          priority: true,
          isRead: true,
          isImportant: true,
          expiresAt: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { isImportant: 'desc' },
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        take: 50, // 限制最多載入 50 筆通知
      });
    }, 'notifications:list');

    return NextResponse.json({ notifications });
  } catch (error) {
    return createErrorResponse(error, 'notifications:list');
  }
}

// 標記通知為已讀
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllAsRead = false } = body;

    await db.query(async (client) => {
      if (markAllAsRead) {
        await client.personalNotification.updateMany({
          where: {
            userId: session.user.id,
            isRead: false,
          },
          data: {
            isRead: true,
          },
        });
      } else if (notificationId) {
        await client.personalNotification.updateMany({
          where: {
            id: notificationId,
            userId: session.user.id,
          },
          data: {
            isRead: true,
          },
        });
      }
    }, 'notifications:mark-read');

    return NextResponse.json({ message: '通知已標記為已讀' });
  } catch (error) {
    return createErrorResponse(error, 'notifications:mark-read');
  }
}
