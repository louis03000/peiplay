import { PrismaClient } from '@prisma/client';

/**
 * 為訂單自動創建聊天室
 */
export async function createChatRoomForBooking(
  client: PrismaClient,
  bookingId: string
): Promise<{ roomId: string; created: boolean } | null> {
  try {
    const chatRoom = (client as any).chatRoom;
    if (!chatRoom) {
      // 如果模型不存在，返回 null（不拋出錯誤）
      return null;
    }

    // 檢查聊天室是否已存在
    const existingRoom = await chatRoom.findFirst({
      where: { bookingId },
    });

    if (existingRoom) {
      return { roomId: existingRoom.id, created: false };
    }

    // 獲取訂單資訊
    const booking = await client.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { include: { user: true } },
        schedule: { include: { partner: { include: { user: true } } } },
      },
    });

    if (!booking) {
      return null;
    }

    // 創建聊天室
    const room = await chatRoom.create({
      data: {
        type: 'ONE_ON_ONE',
        bookingId,
        members: {
          create: [
            { userId: booking.customer.userId },
            { userId: booking.schedule.partner.userId },
          ],
        },
      },
    });

    return { roomId: room.id, created: true };
  } catch (error) {
    console.error('創建聊天室失敗:', error);
    // 不拋出錯誤，避免影響主流程
    return null;
  }
}

