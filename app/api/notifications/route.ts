import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 獲取用戶通知
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 獲取通知列表
    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    // 獲取總數
    const total = await prisma.notification.count({
      where: {
        userId: session.user.id,
        isDeleted: false,
      },
    });

    // 獲取未讀數量
    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
        isDeleted: false,
      },
    });

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    console.error('獲取通知失敗:', error);
    return NextResponse.json(
      { error: '獲取通知失敗' },
      { status: 500 }
    );
  }
}

// 標記所有通知為已讀
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({ message: '所有通知已標記為已讀' });
  } catch (error) {
    console.error('標記通知失敗:', error);
    return NextResponse.json(
      { error: '標記通知失敗' },
      { status: 500 }
    );
  }
}
