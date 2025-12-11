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

    // 優化：支援 cursor-based pagination
    const cursor = searchParams.get('cursor');
    const useCursorPagination = cursor || offset > 100;

    // 優化：避免 OR 條件，分別查詢後合併（提升索引使用率）
    const result = await db.query(async (client) => {
      let messages: any[] = [];
      
      // 優化：使用 cursor-based pagination
      let cursorCondition: any = {};
      if (useCursorPagination && cursor) {
        try {
          const cursorData = JSON.parse(cursor);
          cursorCondition = {
            OR: [
              { createdAt: { lt: new Date(cursorData.createdAt) } },
              {
                createdAt: new Date(cursorData.createdAt),
                id: { lt: cursorData.id },
              },
            ],
          };
        } catch (e) {
          console.warn('Invalid cursor format, falling back to offset');
        }
      }

      // 優化：避免 OR 條件，分別查詢後合併
      if (type === 'sent') {
        messages = await client.message.findMany({
          where: {
            senderId: session.user.id,
            ...cursorCondition,
          },
          select: {
            // 優化：使用 select 而非 include
            id: true,
            senderId: true,
            receiverId: true,
            content: true,
            isRead: true,
            createdAt: true,
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
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          take: limit,
          ...(useCursorPagination ? {} : { skip: offset }),
        });
      } else if (type === 'received') {
        messages = await client.message.findMany({
          where: {
            receiverId: session.user.id,
            ...cursorCondition,
          },
          select: {
            id: true,
            senderId: true,
            receiverId: true,
            content: true,
            isRead: true,
            createdAt: true,
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
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          take: limit,
          ...(useCursorPagination ? {} : { skip: offset }),
        });
      } else {
        // 優化：分別查詢後合併，避免 OR 條件
        const [sentMessages, receivedMessages] = await Promise.all([
          client.message.findMany({
            where: {
              senderId: session.user.id,
              ...cursorCondition,
            },
            select: {
              id: true,
              senderId: true,
              receiverId: true,
              content: true,
              isRead: true,
              createdAt: true,
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
            orderBy: [
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
            take: limit,
            ...(useCursorPagination ? {} : { skip: offset }),
          }),
          client.message.findMany({
            where: {
              receiverId: session.user.id,
              ...cursorCondition,
            },
            select: {
              id: true,
              senderId: true,
              receiverId: true,
              content: true,
              isRead: true,
              createdAt: true,
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
            orderBy: [
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
            take: limit,
            ...(useCursorPagination ? {} : { skip: offset }),
          }),
        ]);
        
        // 合併並去重，按時間排序
        const messageMap = new Map();
        [...sentMessages, ...receivedMessages].forEach(msg => {
          if (!messageMap.has(msg.id)) {
            messageMap.set(msg.id, msg);
          }
        });
        messages = Array.from(messageMap.values())
          .sort((a, b) => {
            const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (timeDiff !== 0) return timeDiff;
            return b.id.localeCompare(a.id);
          })
          .slice(0, limit);
      }

      const unreadCount = await client.message.count({
        where: {
          receiverId: session.user.id,
          isRead: false,
        },
      });

      return { messages, unreadCount };
    }, 'messages:get');

    // 個人資料使用 private cache
    return NextResponse.json(
      {
        messages: result.messages,
        unreadCount: result.unreadCount,
        hasMore: result.messages.length === limit,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
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
