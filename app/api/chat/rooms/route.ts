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
        
        // 獲取用戶參與的所有聊天室，過濾掉已結束的訂單聊天室
        const memberships = await chatRoomMember.findMany({
        where: {
          userId: session.user.id,
          isActive: true,
          // 只包含未結束的訂單聊天室或群組聊天室
          OR: [
            {
              room: {
                groupBookingId: { not: null }, // 群組聊天室
              },
            },
            {
              room: {
                bookingId: { not: null },
                booking: {
                  schedule: {
                    endTime: { gte: now }, // 未結束的訂單
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
                include: {
                  customer: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                  schedule: {
                    include: {
                      partner: {
                        include: {
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
                include: {
                  GroupBookingParticipant: {
                    include: {
                      Customer: {
                        include: {
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

      // 計算未讀訊息數（已結束的訂單聊天室已在查詢時過濾）
      const rooms = await Promise.all(
        memberships.map(async (membership: any) => {
          const lastReadAt = membership.lastReadAt || membership.joinedAt;
          const unreadCount = await (client as any).chatMessage.count({
            where: {
              roomId: membership.roomId,
              senderId: { not: session.user.id },
              createdAt: { gt: lastReadAt },
              moderationStatus: { not: 'REJECTED' },
            },
          });

          return {
            id: membership.room.id,
            type: membership.room.type,
            bookingId: membership.room.bookingId,
            groupBookingId: membership.room.groupBookingId,
            lastMessageAt: membership.room.lastMessageAt,
            unreadCount,
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
          };
        })
      );

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

