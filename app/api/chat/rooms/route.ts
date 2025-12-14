import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { Cache } from '@/lib/redis-cache';

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
      try {
        const chatRoomMember = (client as any).chatRoomMember;
        if (!chatRoomMember) {
          return [];
        }

        // 第一步：獲取用戶的所有活躍聊天室memberships（簡化查詢）
        const memberships = await chatRoomMember.findMany({
          where: {
            userId: session.user.id,
            isActive: true,
          },
          select: {
            roomId: true,
            lastReadAt: true,
            joinedAt: true,
            room: {
              select: {
                id: true,
                type: true,
                bookingId: true,
                groupBookingId: true,
                multiPlayerBookingId: true,
                lastMessageAt: true,
              },
            },
          },
          orderBy: {
            room: {
              lastMessageAt: 'desc',
            },
          },
        });

        const roomIds = memberships.map((m: any) => m.roomId);
        if (roomIds.length === 0) {
          return [];
        }

        // 先篩選出有消息的房間（用於後續查詢）
        const roomsWithMessages = memberships.filter((m: any) => m.room.lastMessageAt);
        const roomIdsWithMessages = roomsWithMessages.map((m: any) => m.roomId);

        // 第二步：並行查詢必要資料（先不查詢消息，後面單獨處理）
        const [roomMembersData, bookingsData, groupBookingsData] = await Promise.all([
          // 查詢所有聊天室的成員
          (client as any).chatRoomMember.findMany({
            where: { roomId: { in: roomIds } },
            select: {
              roomId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          }),
          // 查詢booking資訊（通過chatRoom.bookingId反向查找）
          (client as any).chatRoom.findMany({
            where: {
              id: { in: roomIds },
              bookingId: { not: null },
            },
            select: {
              id: true,
              bookingId: true,
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
            },
          }),
          // 查詢群組預約資訊（通過chatRoom.groupBookingId反向查找）
          (client as any).chatRoom.findMany({
            where: {
              id: { in: roomIds },
              groupBookingId: { not: null },
            },
            select: {
              id: true,
              groupBookingId: true,
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
          }),
        ]);

        // 構建查找Map
        const membersByRoomId = new Map<string, any[]>();
        roomMembersData.forEach((m: any) => {
          if (!membersByRoomId.has(m.roomId)) {
            membersByRoomId.set(m.roomId, []);
          }
          membersByRoomId.get(m.roomId)!.push(m.user);
        });

        // 優化：延遲查詢最新消息（只在有消息的房間查詢，且限制數量）
        const lastMessageByRoomId = new Map<string, any>();
        if (roomIdsWithMessages.length > 0 && roomIdsWithMessages.length <= 30) {
          // 只對前30個有消息的房間查詢最新消息（避免查詢太慢）
          const roomIdsToQuery = roomIdsWithMessages.slice(0, 30);
          
          // 批量查詢，但限制時間範圍（只查最近7天的消息）
          const recentMessages = await (client as any).chatMessage.findMany({
            where: {
              roomId: { in: roomIdsToQuery },
              moderationStatus: { not: 'REJECTED' },
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近7天
              },
            },
            select: {
              id: true,
              roomId: true,
              content: true,
              senderId: true,
              createdAt: true,
              sender: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: [
              { roomId: 'asc' },
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
          });
          
          // 每個房間只取最新一條消息
          recentMessages.forEach((msg: any) => {
            if (!lastMessageByRoomId.has(msg.roomId)) {
              lastMessageByRoomId.set(msg.roomId, msg);
            }
          });
        }

        const bookingByRoomId = new Map<string, any>();
        bookingsData.forEach((room: any) => {
          if (room.booking) {
            bookingByRoomId.set(room.id, room.booking);
          }
        });

        const groupBookingByRoomId = new Map<string, any>();
        groupBookingsData.forEach((room: any) => {
          if (room.groupBooking) {
            groupBookingByRoomId.set(room.id, room.groupBooking);
          }
        });

        // 第三步：優化未讀消息計算 - 先跳過，只計算有 lastMessageAt 的房間
        // 如果未讀數計算很慢，可以先返回 0，讓前端用其他方式處理
        const unreadCountMap = new Map<string, number>();
        
        // 優化：暫時跳過未讀數計算，先讓列表能快速顯示
        // 未讀數可以在進入聊天室時再計算，或者使用 background job 定期更新
        // 如果必須計算，使用批量查詢而非多次 count
        if (roomsWithMessages.length > 0 && roomsWithMessages.length <= 50) {
          // 只對前50個房間計算未讀數（避免太慢）
          const roomsToCalculate = roomsWithMessages.slice(0, 50);
          
          await Promise.all(
            roomsToCalculate.map(async (membership: any) => {
              const lastReadAt = membership.lastReadAt || membership.joinedAt;
              const lastReadDate = lastReadAt instanceof Date
                ? lastReadAt
                : lastReadAt
                  ? new Date(lastReadAt as string | number)
                  : new Date(0);

              try {
                const unreadCount = await (client as any).chatMessage.count({
                  where: {
                    roomId: membership.roomId,
                    senderId: { not: session.user.id },
                    moderationStatus: { not: 'REJECTED' },
                    createdAt: { gt: lastReadDate },
                  },
                });

                unreadCountMap.set(membership.roomId, unreadCount);
              } catch (error) {
                // 如果查詢失敗，設為 0
                unreadCountMap.set(membership.roomId, 0);
              }
            })
          );
        }

        // 構建返回結果
        const rooms = memberships.map((membership: any) => ({
          id: membership.room.id,
          type: membership.room.type,
          bookingId: membership.room.bookingId,
          groupBookingId: membership.room.groupBookingId,
          lastMessageAt: membership.room.lastMessageAt,
          unreadCount: unreadCountMap.get(membership.roomId) || 0,
          members: membersByRoomId.get(membership.roomId) || [],
          lastMessage: lastMessageByRoomId.get(membership.roomId) || null,
          booking: bookingByRoomId.get(membership.roomId) || null,
          groupBooking: groupBookingByRoomId.get(membership.roomId) || null,
        }));

        return rooms;
      } catch (error: any) {
        if (error?.message?.includes('chatRoomMember') || error?.code === 'P2001' || error?.message?.includes('does not exist')) {
          console.warn('聊天室模型尚未建立，請執行資料庫 migration');
          return [];
        }
        throw error;
      }
    }, 'chat:rooms:get');

    // 優化：使用 Redis 快取聊天室列表（短TTL，確保實時性）
    const cacheKey = `chat:rooms:${session.user.id}`;
    const cached = await Cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(
        { rooms: cached },
        {
          headers: {
            'Cache-Control': 'private, max-age=5, stale-while-revalidate=10',
          },
        }
      );
    }

    // 快取結果（5秒TTL）
    await Cache.set(cacheKey, result, 5);

    return NextResponse.json(
      { rooms: result },
      {
        headers: {
          'Cache-Control': 'private, max-age=5, stale-while-revalidate=10',
        },
      }
    );
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

        const isCustomer = booking.customer.userId === session.user.id;
        const isPartner = booking.schedule.partner.userId === session.user.id;
        const isAdmin = session.user.role === 'ADMIN';
        
        if (!isCustomer && !isPartner && !isAdmin) {
          throw new Error('無權限創建此聊天室');
        }

        memberUserIds = [
          booking.customer.userId,
          booking.schedule.partner.userId,
        ];
      } else if (groupBookingId) {
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

        memberUserIds = groupBooking.GroupBookingParticipant
          .map((p: any) => p.Customer?.userId || p.Partner?.userId)
          .filter((id: any): id is string => !!id);

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
