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

/**
 * 為預聊獲取或創建聊天室（基於 userId 和 partnerId，無 bookingId）
 * 這是統一預聊和聊天室數據源的關鍵函數
 */
export async function getOrCreateChatRoomForPreChat(
  client: PrismaClient | any, // 支持事務客戶端
  userId: string,
  partnerId: string
): Promise<{ roomId: string; created: boolean } | null> {
  try {
    const chatRoom = (client as any).chatRoom;
    if (!chatRoom) {
      return null;
    }

    // 查找已存在的聊天室（通過成員關係）
    // 查找包含這兩個用戶的 ONE_ON_ONE 聊天室（且沒有 bookingId）
    // 先查找第一個用戶的成員關係
    const userMemberships = await (client as any).chatRoomMember.findMany({
      where: {
        userId: userId,
        isActive: true,
      },
      include: {
        room: {
          where: {
            type: 'ONE_ON_ONE',
            bookingId: null,
            groupBookingId: null,
            multiPlayerBookingId: null,
          },
          include: {
            members: {
              where: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    // 找到包含兩個用戶的聊天室
    for (const membership of userMemberships) {
      if (membership.room) {
        const memberIds = membership.room.members.map((m: any) => m.userId);
        // 檢查是否包含兩個用戶
        if (memberIds.includes(userId) && memberIds.includes(partnerId) && memberIds.length === 2) {
          return { roomId: membership.room.id, created: false };
        }
      }
    }

    // 如果不存在，創建新的聊天室
    const room = await chatRoom.create({
      data: {
        type: 'ONE_ON_ONE',
        members: {
          create: [
            { userId },
            { userId: partnerId },
          ],
        },
      },
    });

    return { roomId: room.id, created: true };
  } catch (error) {
    console.error('獲取或創建預聊聊天室失敗:', error);
    return null;
  }
}

