import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chatrooms?partnerId={partnerId}
 * 建立或取得聊天室
 * 
 * 說明：檢查當前登入使用者與指定 partnerId 的陪玩師是否已有聊天；
 * 若無則建立新聊天室。
 * 
 * 回傳：{ chatId, isClosed, createdAt, messages: [ ... 最多 10 則最新訊息 ... ] }
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');

    if (!partnerId) {
      return NextResponse.json({ error: '需要提供 partnerId' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      // 先檢查 partnerId 是 Partner ID 還是 User ID
      // 如果是 Partner ID，需要轉換為 User ID
      let partnerUserId: string;
      
      // 先嘗試作為 Partner ID 查詢
      const partner = await (client as any).partner.findUnique({
        where: { id: partnerId },
        select: { userId: true },
      });
      
      if (partner) {
        // 是 Partner ID，使用對應的 userId
        partnerUserId = partner.userId;
      } else {
        // 可能是 User ID，驗證是否存在
        const user = await client.user.findUnique({
          where: { id: partnerId },
          select: { id: true },
        });
        
        if (!user) {
          throw new Error('陪玩師不存在');
        }
        
        partnerUserId = partnerId;
      }
      
      // 檢查聊天室是否已存在（使用 findFirst 因為 Prisma 可能還沒生成複合鍵名稱）
      let room = await (client as any).preChatRoom.findFirst({
        where: {
          userId: session.user.id,
          partnerId: partnerUserId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      // 如果不存在或已過期，建立新聊天室
      if (!room || new Date(room.expiresAt) < new Date()) {
        // 如果已過期，先刪除舊的
        if (room) {
          await (client as any).preChatRoom.delete({
            where: { id: room.id },
          });
        }

        // 建立新聊天室（24 小時後過期）
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        room = await (client as any).preChatRoom.create({
          data: {
            userId: session.user.id,
            partnerId: partnerUserId,
            status: 'open',
            messageCount: 0,
            expiresAt: expiresAt,
          },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        });
      }

      // 檢查聊天室是否已過期
      const isExpired = new Date(room.expiresAt) < new Date();
      if (isExpired) {
        room.status = 'expired';
      }

      // 格式化訊息
      const messages = room.messages
        .reverse() // 反轉為時間正序
        .map((msg: any) => ({
          id: msg.id.toString(),
          senderId: msg.senderType === 'user' ? session.user.id : partnerUserId,
          senderType: msg.senderType,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
        }));

      return {
        chatId: room.id,
        isClosed: room.status !== 'open',
        createdAt: room.createdAt.toISOString(),
        expiresAt: room.expiresAt.toISOString(),
        messageCount: room.messageCount,
        status: room.status,
        messages,
      };
    }, 'chatrooms:get');

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'chatrooms:get');
  }
}

