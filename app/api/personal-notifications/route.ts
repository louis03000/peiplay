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
      
      // 優化策略：使用批量查詢而非 JOIN
      // 1. 先查詢通知（不 JOIN sender，速度更快）
      // 2. 批量查詢所有發送者（只查詢一次 User 表）
      // 3. 在應用層合併資料
      // 這樣可以同時擁有功能和速度
      
      // 第一步：查詢通知（不 JOIN sender，速度更快）
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
          senderId: true, // 獲取 senderId，用於批量查詢
        },
        // 使用 createdAt DESC 排序，利用現有索引
        orderBy: { createdAt: 'desc' },
        // 減少為 50 筆，提升速度
        take: 50,
      });
      
      // 在應用層過濾過期通知
      const validNotifications = allNotifications.filter(notification => {
        if (!notification.expiresAt) return true;
        return new Date(notification.expiresAt) > now;
      });
      
      // 第二步：批量查詢所有發送者（只查詢一次，比 JOIN 快）
      const senderIds = [...new Set(validNotifications.map(n => n.senderId).filter(Boolean))];
      let senderMap = new Map<string, { id: string; name: string }>();
      
      if (senderIds.length > 0) {
        const senders = await client.user.findMany({
          where: {
            id: { in: senderIds },
          },
          select: {
            id: true,
            name: true,
          },
        });
        
        // 建立 senderId -> sender 的映射
        senderMap = new Map(senders.map(s => [s.id, { id: s.id, name: s.name || '系統' }]));
      }
      
      // 第三步：在應用層合併資料
      const notificationsWithSenders = validNotifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        content: notification.content,
        type: notification.type,
        priority: notification.priority,
        isRead: notification.isRead,
        isImportant: notification.isImportant,
        expiresAt: notification.expiresAt,
        createdAt: notification.createdAt,
        sender: notification.senderId 
          ? (senderMap.get(notification.senderId) || { id: notification.senderId, name: '系統' })
          : { id: '', name: '系統' },
      }));
      
      // 在應用層排序：重要通知優先，然後按優先級，最後按時間
      const sortedNotifications = notificationsWithSenders.sort((a, b) => {
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
      
      // 只返回前 30 筆（減少資料傳輸）
      return sortedNotifications.slice(0, 30);
    }, 'notifications:list');

    // 直接返回，已經包含 sender 資訊
    const formattedNotifications = notifications;

    // 個人通知使用 private cache（只快取在用戶瀏覽器中）
    return NextResponse.json(
      { notifications: formattedNotifications },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
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
