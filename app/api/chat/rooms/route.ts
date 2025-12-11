import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/rooms
 * 獲取用戶的聊天室列表
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const result = await db.query(async (client) => {
      // 使用動態訪問來避免 TypeScript 類型錯誤（如果 migration 還沒執行）
      try {
        const chatRoomMember = (client as any).chatRoomMember;
        if (!chatRoomMember) {
          // 如果模型不存在，返回空陣列
          return [];
        }

        const now = new Date();
        
        // 獲取用戶參與的所有聊天室，包含：
        // 1. 免費聊天室（所有 bookingId 都為 null）
        // 2. 未結束的訂單聊天室
        // 3. 群組聊天室
        const memberships = await chatRoomMember.findMany({
        where: {
          userId: session.user.id,
          isActive: true,
          OR: [
            {
              // 免費聊天室（所有 booking 相關 ID 都為 null）
              room: {
                bookingId: null,
                groupBookingId: null,
                multiPlayerBookingId: null,
              },
            },
            {
              // 群組聊天室
              room: {
                groupBookingId: { not: null },
              },
            },
            {
              // 未結束的訂單聊天室
              room: {
                bookingId: { not: null },
                booking: {
                  schedule: {
                    endTime: { gte: now },
                  },
                },
              },
            },
          ],
        },
        include: {
          room: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      role: true,
                    },
                  },
                },
              },
              messages: {
                take: 1,
                orderBy: { createdAt: 'desc' },
                include: {
                  sender: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              booking: {
                select: {
                  id: true,
                  status: true,
                  customer: {
                    select: {
                      userId: true,
                      user: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                  schedule: {
                    select: {
                      partner: {
                        select: {
                          userId: true,
                          user: {
                            select: {
                              id: true,
                              name: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              groupBooking: {
                select: {
                  id: true,
                  GroupBookingParticipant: {
                    select: {
                      Customer: {
                        select: {
                          userId: true,
                          user: {
                            select: {
                              id: true,
                              name: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          room: {
            lastMessageAt: 'desc',
          },
        },
      });

      // 優化：批量查詢未讀訊息數（只查詢有 lastMessageAt 的房間，減少查詢量）
      const roomIds = memberships.map((m: any) => m.roomId);
      const lastReadMap = new Map<string, Date>();
      
      // 只處理有 lastMessageAt 的房間（有消息的房間才需要計算未讀數）
      memberships.forEach((m: any) => {
        if (m.room.lastMessageAt) {
          const readAt = m.lastReadAt || m.joinedAt;
          const readDate = readAt instanceof Date 
            ? readAt 
            : readAt 
              ? new Date(readAt as string | number)
              : new Date(0); // 如果沒有讀取時間，從最早開始計算
          lastReadMap.set(m.roomId, readDate);
        }
      });

      // 只查詢有 lastMessageAt 的房間的未讀訊息（優化查詢）
      const roomsWithMessages = roomIds.filter((id: string) => {
        const membership = memberships.find((m: any) => m.roomId === id);
        return membership?.room.lastMessageAt;
      });

      const unreadCountMap = new Map<string, number>();
      
      if (roomsWithMessages.length > 0) {
        // 批量查詢所有未讀訊息（只查詢有消息的房間）
        const unreadMessages = await (client as any).chatMessage.findMany({
          where: {
            roomId: { in: roomsWithMessages },
            senderId: { not: session.user.id },
            moderationStatus: { not: 'REJECTED' },
          },
          select: {
            roomId: true,
            createdAt: true,
          },
        });

        // 計算每個聊天室的未讀數
        unreadMessages.forEach((msg: any) => {
          const lastReadDate = lastReadMap.get(msg.roomId);
          if (lastReadDate) {
            const messageDate = new Date(msg.createdAt);
            if (messageDate > lastReadDate) {
              unreadCountMap.set(
                msg.roomId,
                (unreadCountMap.get(msg.roomId) || 0) + 1
              );
            }
          }
        });
      }

      // 構建返回結果
      const rooms = memberships.map((membership: any) => ({
        id: membership.room.id,
        type: membership.room.type,
        bookingId: membership.room.bookingId,
        groupBookingId: membership.room.groupBookingId,
        lastMessageAt: membership.room.lastMessageAt,
        unreadCount: unreadCountMap.get(membership.roomId) || 0,
        members: membership.room.members.map((m: any) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.user.role,
        })),
        lastMessage: membership.room.messages[0]
          ? {
              id: membership.room.messages[0].id,
              content: membership.room.messages[0].content,
              senderId: membership.room.messages[0].senderId,
              sender: membership.room.messages[0].sender,
              createdAt: membership.room.messages[0].createdAt,
            }
          : null,
        booking: membership.room.booking,
        groupBooking: membership.room.groupBooking,
      }));

        return rooms;
      } catch (error: any) {
        // 如果模型不存在（通常是 Prisma 錯誤），返回空陣列
        if (error?.message?.includes('chatRoomMember') || error?.code === 'P2001' || error?.message?.includes('does not exist')) {
          console.warn('聊天室模型尚未建立，請執行資料庫 migration');
          return [];
        }
        throw error;
      }
    }, 'chat:rooms:get');

    return NextResponse.json({ rooms: result });
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:get');
  }
}

/**
 * POST /api/chat/rooms
 * 創建聊天室（基於訂單或群組預約）
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, groupBookingId } = body;

    if (!bookingId && !groupBookingId) {
      return NextResponse.json(
        { error: '需要提供 bookingId 或 groupBookingId' },
        { status: 400 }
      );
    }

    const result = await db.query(async (client) => {
      // 檢查模型是否存在（如果 migration 還沒執行）
      try {
        const testQuery = (client as any).chatRoom;
        if (!testQuery) {
          throw new Error('聊天功能尚未啟用，請先執行資料庫 migration');
        }
      } catch (error) {
        throw new Error('聊天功能尚未啟用，請先執行資料庫 migration');
      }

      // 檢查聊天室是否已存在
      const existingRoom = await (client as any).chatRoom.findFirst({
        where: {
          OR: [
            { bookingId: bookingId || undefined },
            { groupBookingId: groupBookingId || undefined },
          ],
        },
      });

      if (existingRoom) {
        return { room: existingRoom, created: false };
      }

      // 創建新聊天室
      let roomType: 'ONE_ON_ONE' | 'GROUP' = 'ONE_ON_ONE';
      let memberUserIds: string[] = [];

      if (bookingId) {
        // 一對一聊天室：客戶和陪玩
        const booking = await (client as any).booking.findUnique({
          where: { id: bookingId },
          include: {
            customer: { include: { user: true } },
            schedule: { include: { partner: { include: { user: true } } } },
          },
        });

        if (!booking) {
          throw new Error('訂單不存在');
        }

        // 驗證用戶是否有權限（放寬條件，只要是用戶或陪玩就可以）
        const isCustomer = booking.customer.userId === session.user.id;
        const isPartner = booking.schedule.partner.userId === session.user.id;
        const isAdmin = session.user.role === 'ADMIN';
        
        if (!isCustomer && !isPartner && !isAdmin) {
          throw new Error('無權限創建此聊天室');
        }
        
        // 允許更多狀態的訂單創建聊天室（不只是 CONFIRMED）
        // 只要不是 PENDING、REJECTED、CANCELLED 都可以
        const allowedStatuses = [
          'CONFIRMED',
          'PARTNER_ACCEPTED',
          'COMPLETED',
          'PAID_WAITING_PARTNER_CONFIRMATION',
        ];
        
        if (!allowedStatuses.includes(booking.status)) {
          // 不拋出錯誤，但記錄警告
          console.warn(`訂單 ${bookingId} 狀態為 ${booking.status}，通常不會有聊天室`);
        }

        memberUserIds = [
          booking.customer.userId,
          booking.schedule.partner.userId,
        ];
      } else if (groupBookingId) {
        // 群組聊天室
        roomType = 'GROUP';
        const groupBooking = await (client as any).groupBooking.findUnique({
          where: { id: groupBookingId },
          include: {
            GroupBookingParticipant: {
              include: {
                Customer: { include: { user: true } },
                Partner: { include: { user: true } },
              },
            },
          },
        });

        if (!groupBooking) {
          throw new Error('群組預約不存在');
        }

        // 收集所有參與者的 userId
        memberUserIds = groupBooking.GroupBookingParticipant
          .map((p: any) => p.Customer?.userId || p.Partner?.userId)
          .filter((id: any): id is string => !!id);

        // 驗證用戶是否有權限
        if (
          !memberUserIds.includes(session.user.id) &&
          session.user.role !== 'ADMIN'
        ) {
          throw new Error('無權限創建此聊天室');
        }
      }

      // 創建聊天室和成員
      const room = await (client as any).chatRoom.create({
        data: {
          type: roomType,
          bookingId: bookingId || null,
          groupBookingId: groupBookingId || null,
          members: {
            create: memberUserIds.map((userId: string) => ({
              userId,
            })),
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      return { room, created: true };
    }, 'chat:rooms:post');

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:post');
  }
}

