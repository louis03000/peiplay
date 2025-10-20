import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// 獲取用戶的訊息列表
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'sent' | 'received' | 'all'
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    
    if (type === 'sent') {
      where.senderId = session.user.id;
    } else if (type === 'received') {
      where.receiverId = session.user.id;
    } else {
      // 獲取所有相關訊息（發送和接收）
      where.OR = [
        { senderId: session.user.id },
        { receiverId: session.user.id }
      ];
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // 獲取未讀訊息數量
    const unreadCount = await prisma.message.count({
      where: {
        receiverId: session.user.id,
        isRead: false
      }
    });

    return NextResponse.json({
      messages,
      unreadCount,
      hasMore: messages.length === limit
    });

  } catch (error) {
    console.error('獲取訊息失敗:', error);
    return NextResponse.json({ error: '獲取訊息失敗' }, { status: 500 });
  }
}

// 發送新訊息
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { receiverId, content } = await request.json();

    if (!receiverId || !content) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    if (receiverId === session.user.id) {
      return NextResponse.json({ error: '不能發送訊息給自己' }, { status: 400 });
    }

    // 檢查接收者是否存在
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    });

    if (!receiver) {
      return NextResponse.json({ error: '接收者不存在' }, { status: 404 });
    }

    // 創建訊息
    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId,
        content: content.trim()
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    // 創建通知
    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: '新訊息',
        content: `您收到來自 ${message.sender.name || message.sender.email} 的新訊息`,
        type: 'MESSAGE_RECEIVED',
        data: {
          messageId: message.id,
          senderId: session.user.id
        }
      }
    });

    // 如果接收者啟用了 Email 通知，發送 Email
    if (receiver.messageNotifications) {
      try {
        // 這裡可以整合 Email 發送功能
        console.log(`發送 Email 通知給 ${receiver.email}`);
      } catch (emailError) {
        console.error('Email 發送失敗:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message
    });

  } catch (error) {
    console.error('發送訊息失敗:', error);
    return NextResponse.json({ error: '發送訊息失敗' }, { status: 500 });
  }
}
