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

        // ✅ 關鍵優化：只查詢必要的成員資料，booking 和 groupBooking 延後查詢
        // 先讓列表能快速顯示（< 1 秒），詳細資料可以在進入聊天室時再查詢
        const roomMembersData = await (client as any).chatRoomMember.findMany({
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
        });
        
        // 暫時跳過 booking 和 groupBooking 查詢（太慢）
        // 這些資料可以在進入聊天室時再查詢，或者使用 denormalized 字段
        const bookingsData: any[] = [];
        const groupBookingsData: any[] = [];

        // 構建查找Map
        const membersByRoomId = new Map<string, any[]>();
        roomMembersData.forEach((m: any) => {
          if (!membersByRoomId.has(m.roomId)) {
            membersByRoomId.set(m.roomId, []);
          }
          membersByRoomId.get(m.roomId)!.push(m.user);
        });

        // ✅ 關鍵優化：不查詢最新消息內容（太慢）
        // 只使用 lastMessageAt 時間戳，不查詢消息內容
        // 前端可以從 lastMessageAt 判斷是否有消息，不需要實際內容
        const lastMessageByRoomId = new Map<string, any>();
        
        // 只為有 lastMessageAt 的房間創建一個簡單的 lastMessage 對象
        roomsWithMessages.forEach((membership: any) => {
          if (membership.room.lastMessageAt) {
            lastMessageByRoomId.set(membership.roomId, {
              id: 'placeholder', // 不需要實際 ID
              content: '...',     // 不需要實際內容（前端不顯示）
              senderId: '',
              sender: { name: '', email: '' },
              createdAt: membership.room.lastMessageAt,
            });
          }
        });

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

        // ✅ 關鍵優化：暫時跳過未讀數計算（太慢）
        // 未讀數可以在進入聊天室時再計算，或者使用 background job 定期更新
        // 先讓列表能快速顯示（< 1 秒）
        const unreadCountMap = new Map<string, number>();
        // 所有房間未讀數設為 0（暫時）

        // ✅ 構建返回結果 - 只返回有消息的聊天室
        const rooms = memberships
          .filter((membership: any) => membership.room.lastMessageAt) // 只顯示有消息的
          .map((membership: any) => ({
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
