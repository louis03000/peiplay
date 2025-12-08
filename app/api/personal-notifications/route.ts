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
      
      // 優化策略：
      // 1. 使用單一查詢，但優化查詢條件以利用索引
      // 2. 先查詢最近的 100 筆通知（使用 userId + createdAt 索引）
      // 3. 在應用層過濾過期通知和排序（避免複雜的資料庫排序）
      // 4. 減少 JOIN：只查詢必要的 sender 資訊
      
      // 使用 userId + createdAt 索引進行快速查詢
      // 先取較多資料，然後在應用層過濾和排序
      const allNotifications = await client.personalNotification.findMany({
        where: {
          userId: session.user.id,
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
        // 使用 createdAt DESC 排序，利用現有索引
        orderBy: { createdAt: 'desc' },
        // 先取 100 筆，然後在應用層過濾和排序
        take: 100,
      });
      
      // 在應用層過濾過期通知
      const validNotifications = allNotifications.filter(notification => {
        if (!notification.expiresAt) return true;
        return new Date(notification.expiresAt) > now;
      });
      
      // 在應用層排序：重要通知優先，然後按優先級，最後按時間
      const sortedNotifications = validNotifications.sort((a, b) => {
        // 1. 重要通知優先
        if (a.isImportant !== b.isImportant) {
          return a.isImportant ? -1 : 1;
        }
        // 2. 優先級高的優先
        const priorityOrder: Record<string, number> = { 
          URGENT: 4, 
          HIGH: 3, 
          MEDIUM: 2, 
          LOW: 1 
        };
        const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        // 3. 最新的優先
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // 只返回前 50 筆
      return sortedNotifications.slice(0, 50);
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
