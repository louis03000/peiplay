import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取當前用戶的個人通知
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    await prisma.$connect();

    const notifications = await prisma.personalNotification.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: [
        { isImportant: 'desc' },
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({ notifications });

  } catch (error) {
    console.error('❌ 獲取個人通知失敗:', error);
    return NextResponse.json({
      error: '獲取個人通知失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}

// 標記通知為已讀
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllAsRead = false } = body;

    await prisma.$connect();

    if (markAllAsRead) {
      // 標記所有通知為已讀
      await prisma.personalNotification.updateMany({
        where: {
          userId: session.user.id,
          isRead: false
        },
        data: {
          isRead: true
        }
      });
    } else if (notificationId) {
      // 標記特定通知為已讀
      await prisma.personalNotification.updateMany({
        where: {
          id: notificationId,
          userId: session.user.id
        },
        data: {
          isRead: true
        }
      });
    }

    return NextResponse.json({ message: '通知已標記為已讀' });

  } catch (error) {
    console.error('❌ 標記通知失敗:', error);
    return NextResponse.json({
      error: '標記通知失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}
