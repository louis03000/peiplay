import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 獲取用戶的信箱訊息
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 構建查詢條件
    const where: any = {
      receiverId: session.user.id,
      isDeleted: false,
    };

    if (type !== 'all') {
      where.type = type;
    }

    // 獲取訊息列表
    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    // 獲取總數
    const total = await prisma.message.count({ where });

    // 獲取未讀數量
    const unreadCount = await prisma.message.count({
      where: {
        receiverId: session.user.id,
        isRead: false,
        isDeleted: false,
      },
    });

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    console.error('獲取訊息失敗:', error);
    return NextResponse.json(
      { error: '獲取訊息失敗' },
      { status: 500 }
    );
  }
}

// 發送新訊息
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, subject, content, type = 'PRIVATE', relatedId, attachments = [] } = body;

    if (!receiverId || !subject || !content) {
      return NextResponse.json(
        { error: '缺少必要欄位' },
        { status: 400 }
      );
    }

    // 檢查接收者是否存在
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: '接收者不存在' },
        { status: 404 }
      );
    }

    // 創建訊息
    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId,
        subject,
        content,
        type,
        relatedId,
        attachments,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // 創建通知
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'MESSAGE_RECEIVED',
        title: '新訊息',
        content: `您收到來自 ${message.sender.name} 的新訊息：${subject}`,
        data: {
          messageId: message.id,
          senderId: session.user.id,
          senderName: message.sender.name,
        },
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('發送訊息失敗:', error);
    return NextResponse.json(
      { error: '發送訊息失敗' },
      { status: 500 }
    );
  }
}
