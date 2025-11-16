import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/rooms/[roomId]/read
 * 標記聊天室訊息為已讀
 */
export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { roomId } = params;
    const body = await request.json();
    const { messageIds } = body; // 可選：指定要標記的訊息 ID 列表

    const result = await db.query(async (client) => {
      // 驗證用戶是否有權限
      const membership = await client.chatRoomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: session.user.id,
          },
        },
      });

      if (!membership) {
        throw new Error('無權限訪問此聊天室');
      }

      // 更新最後讀取時間
      await client.chatRoomMember.update({
        where: {
          roomId_userId: {
            roomId,
            userId: session.user.id,
          },
        },
        data: {
          lastReadAt: new Date(),
        },
      });

      // 如果指定了訊息 ID，為這些訊息創建已讀回條
      if (messageIds && Array.isArray(messageIds)) {
        await Promise.all(
          messageIds.map((messageId: string) =>
            client.messageReadReceipt.upsert({
              where: {
                messageId_userId: {
                  messageId,
                  userId: session.user.id,
                },
              },
              create: {
                messageId,
                userId: session.user.id,
              },
              update: {},
            })
          )
        );
      } else {
        // 標記所有未讀訊息為已讀
        const unreadMessages = await client.chatMessage.findMany({
          where: {
            roomId,
            senderId: { not: session.user.id },
            moderationStatus: { not: 'REJECTED' },
            readReceipts: {
              none: {
                userId: session.user.id,
              },
            },
          },
          select: { id: true },
        });

        await Promise.all(
          unreadMessages.map((msg) =>
            client.messageReadReceipt.create({
              data: {
                messageId: msg.id,
                userId: session.user.id,
              },
            })
          )
        );
      }

      return { success: true };
    }, 'chat:rooms:roomId:read:post');

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:read:post');
  }
}

