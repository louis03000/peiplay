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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};

    if (type === 'sent') {
      where.senderId = session.user.id;
    } else if (type === 'received') {
      where.receiverId = session.user.id;
    } else {
      where.OR = [
        { senderId: session.user.id },
        { receiverId: session.user.id },
      ];
    }

    const result = await db.query(async (client) => {
      const [messages, unreadCount] = await Promise.all([
        client.message.findMany({
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
            receiver: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        client.message.count({
          where: {
            receiverId: session.user.id,
            isRead: false,
          },
        }),
      ]);

      return { messages, unreadCount };
    }, 'messages:get');

    return NextResponse.json({
      messages: result.messages,
      unreadCount: result.unreadCount,
      hasMore: result.messages.length === limit,
    });
  } catch (error) {
    return createErrorResponse(error, 'messages:get');
  }
}

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

    const result = await db.query(async (client) => {
      const receiver = await client.user.findUnique({
        where: { id: receiverId },
        select: {
          id: true,
          email: true,
          name: true,
          messageNotifications: true,
        },
      });

      if (!receiver) {
        return { type: 'NOT_FOUND' } as const;
      }

      const message = await client.$transaction(async (tx) => {
        const createdMessage = await tx.message.create({
          data: {
            senderId: session.user.id,
            receiverId,
            content: content.trim(),
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

        await tx.notification.create({
          data: {
            userId: receiverId,
            title: '新訊息',
            content: `您收到來自 ${createdMessage.sender.name || createdMessage.sender.email} 的新訊息`,
            type: 'MESSAGE_RECEIVED',
            data: {
              messageId: createdMessage.id,
              senderId: session.user.id,
            },
          },
        });

        return createdMessage;
      });

      return {
        type: 'SUCCESS',
        message,
        receiver,
      } as const;
    }, 'messages:post');

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '接收者不存在' }, { status: 404 });
    }

    if (result.receiver.messageNotifications) {
      try {
        console.log(`發送 Email 通知給 ${result.receiver.email}`);
      } catch (emailError) {
        console.error('Email 發送失敗:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return createErrorResponse(error, 'messages:post');
  }
}
