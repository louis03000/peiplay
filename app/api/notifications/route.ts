import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// 獲取用戶的通知列表
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 通知類型
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {
      userId: session.user.id
    };

    if (type) {
      where.type = type;
    }

    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // 獲取未讀通知數量
    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false
      }
    });

    return NextResponse.json({
      notifications,
      unreadCount,
      hasMore: notifications.length === limit
    });

  } catch (error) {
    console.error('獲取通知失敗:', error);
    return NextResponse.json({ error: '獲取通知失敗' }, { status: 500 });
  }
}

// 標記所有通知為已讀
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { type } = await request.json();

    const where: any = {
      userId: session.user.id,
      isRead: false
    };

    if (type) {
      where.type = type;
    }

    await prisma.notification.updateMany({
      where,
      data: { isRead: true }
    });

    return NextResponse.json({
      success: true,
      message: '通知已標記為已讀'
    });

  } catch (error) {
    console.error('標記通知已讀失敗:', error);
    return NextResponse.json({ error: '標記通知已讀失敗' }, { status: 500 });
  }
}
