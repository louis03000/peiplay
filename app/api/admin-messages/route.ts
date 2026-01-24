import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 管理員私訊系統 API
 *
 * 路徑：/api/admin-messages
 * - GET:  ?userId=xxx  取得指定用戶與管理員之間的 AdminMessage 訊息紀錄（僅 ADMIN）
 * - POST: { userId, content } 由目前登入的管理員發送訊息給指定用戶
 *
 * 設計重點：
 * 1. 所有訊息會寫入 AdminMessage 表，方便在管理後台查看與對帳
 * 2. 同時會為「管理員 + 該用戶」建立一個 ONE_ON_ONE 聊天室（如尚未存在）
 * 3. 再透過內部呼叫 /api/chat/rooms/[roomId]/messages，把同一則訊息送到一般聊天室
 */

// 取得訊息列表（後台管理員查看）
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: '缺少 userId 參數' }, { status: 400 })
    }

    const result = await db.query(
      async (client) => {
        const messages = await client.adminMessage.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            admin: {
              select: { id: true, name: true, email: true },
            },
          },
        })

        return {
          messages: messages.map((m) => ({
            id: m.id,
            content: m.content,
            isRead: m.isRead,
            isFromAdmin: m.isFromAdmin,
            createdAt: m.createdAt,
            user: m.user
              ? {
                  id: m.user.id,
                  name: m.user.name,
                  email: m.user.email,
                }
              : undefined,
            admin: m.admin
              ? {
                  id: m.admin.id,
                  name: m.admin.name,
                  email: m.admin.email ?? undefined,
                }
              : undefined,
          })),
        }
      },
      'admin-messages:get'
    )

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, 'admin-messages:get')
  }
}

// 發送管理員訊息（後台管理員 -> 用戶）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminId = session.user.id
    if (!adminId) {
      return NextResponse.json(
        { error: '無法識別管理員，請重新登入' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => null)
    const { userId, content } = body || {}

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: '缺少 userId 參數' }, { status: 400 })
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: '訊息內容不能為空' }, { status: 400 })
    }

    const trimmedContent = content.trim()

    // 1) 寫入 AdminMessage 表（後台記錄用）
    const adminMessage = await db.query(
      async (client) => {
        // 確認目標用戶存在，避免孤兒紀錄
        const targetUser = await client.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true },
        })

        if (!targetUser) {
          return { type: 'USER_NOT_FOUND' as const }
        }

        const msg = await client.adminMessage.create({
          data: {
            userId,
            adminId,
            content: trimmedContent,
            isFromAdmin: true,
          },
        })

        return {
          type: 'SUCCESS' as const,
          payload: {
            adminMessage: msg,
            targetUser,
          },
        }
      },
      'admin-messages:post:create'
    )

    if (adminMessage.type === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: '目標用戶不存在' }, { status: 404 })
    }

    const { adminMessage: createdAdminMessage, targetUser } = adminMessage.payload

    // 2) 確保有一個「管理員 <-> 用戶」的 ONE_ON_ONE 聊天室
    let roomId: string | null = null
    try {
      const chatRoomResult = await db.query(
        async (client) => {
          // 找出所有 candidate rooms
          const existingRooms = await (client as any).chatRoom.findMany({
            where: {
              bookingId: null,
              groupBookingId: null,
              multiPlayerBookingId: null,
              type: 'ONE_ON_ONE',
              members: {
                some: {
                  userId: {
                    in: [adminId, userId],
                  },
                },
              },
            },
            include: {
              members: {
                select: { userId: true },
              },
            },
          })

          const existingRoom = existingRooms.find((room: any) => {
            const memberIds = room.members.map((m: any) => m.userId)
            return (
              memberIds.includes(adminId) &&
              memberIds.includes(userId) &&
              memberIds.length === 2
            )
          })

          if (existingRoom) {
            return { roomId: existingRoom.id, created: false as const }
          }

          // 創建新的聊天室（管理員 + 用戶）
          const room = await (client as any).chatRoom.create({
            data: {
              type: 'ONE_ON_ONE',
              bookingId: null,
              groupBookingId: null,
              multiPlayerBookingId: null,
              members: {
                create: [{ userId: adminId }, { userId }],
              },
            },
          })

          return { roomId: room.id, created: true as const }
        },
        'admin-messages:post:ensure-room'
      )

      roomId = chatRoomResult.roomId
    } catch (error) {
      console.error('[admin-messages] 確保聊天室存在時發生錯誤:', error)
      // 不影響 AdminMessage 主流程，繼續往下
    }

    // 3) 如果有 roomId，將同一則訊息送進 ChatMessage（聊天室）
    if (roomId) {
      try {
        const baseUrl =
          process.env.NEXTAUTH_URL ||
          (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
          'http://localhost:3000'

        const chatRes = await fetch(
          `${baseUrl}/api/chat/rooms/${roomId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: trimmedContent,
            }),
          }
        )

        if (!chatRes.ok) {
          const err = await chatRes.json().catch(() => ({}))
          console.warn(
            '[admin-messages] 將訊息同步到聊天室失敗:',
            chatRes.status,
            err
          )
        }
      } catch (error) {
        console.error('[admin-messages] 呼叫聊天室訊息 API 失敗:', error)
        // 不阻斷主流程
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        id: createdAdminMessage.id,
        content: createdAdminMessage.content,
        isRead: createdAdminMessage.isRead,
        isFromAdmin: createdAdminMessage.isFromAdmin,
        createdAt: createdAdminMessage.createdAt,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
        },
        admin: {
          id: adminId,
          name: session.user.name || '管理員',
        },
      },
    })
  } catch (error) {
    return createErrorResponse(error, 'admin-messages:post')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

/**
 * 管理員私訊系統 API
 *
 * 路徑：/api/admin-messages
 * - GET:  ?userId=xxx  取得指定用戶與管理員之間的 AdminMessage 訊息紀錄
 * - POST: { userId, content } 由目前登入的管理員發送訊息給指定用戶
 *
 * 設計重點：
 * 1. 所有訊息會寫入 AdminMessage 表，方便在管理後台查看與對帳
 * 2. 同時會為「管理員 + 該用戶」建立一個 ONE_ON_ONE 聊天室（如尚未存在）
 * 3. 再透過內部呼叫 /api/chat/rooms/[roomId]/messages，把同一則訊息送到一般聊天室
 *    -> 這樣用戶在 `/chat` 頁面就會看到這則訊息，滿足「同步出現在聊天室」的需求
 */

// 取得訊息列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: '缺少 userId 參數' }, { status: 400 })
    }

    const result = await db.query(
      async (client) => {
        const messages = await client.adminMessage.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            admin: {
              select: { id: true, name: true, email: true },
            },
          },
        })

        return messages.map((m) => ({
          id: m.id,
          content: m.content,
          isRead: m.isRead,
          isFromAdmin: m.isFromAdmin,
          createdAt: m.createdAt,
          user: m.user
            ? {
                id: m.user.id,
                name: m.user.name,
                email: m.user.email,
              }
            : undefined,
          admin: m.admin
            ? {
                id: m.admin.id,
                name: m.admin.name,
              }
            : undefined,
        }))
      },
      'admin-messages:get'
    )

    return NextResponse.json({ messages: result })
  } catch (error) {
    return createErrorResponse(error, 'admin-messages:get')
  }
}

// 發送管理員訊息
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminId = session.user.id
    if (!adminId) {
      return NextResponse.json({ error: '無法識別管理員，請重新登入' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const { userId, content } = body || {}

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: '缺少 userId 參數' }, { status: 400 })
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: '訊息內容不能為空' }, { status: 400 })
    }

    const trimmedContent = content.trim()

    // 1) 寫入 AdminMessage 表（後台記錄用）
    const adminMessage = await db.query(
      async (client) => {
        // 確認目標用戶存在，避免孤兒紀錄
        const targetUser = await client.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true },
        })

        if (!targetUser) {
          return { type: 'USER_NOT_FOUND' as const }
        }

        const msg = await client.adminMessage.create({
          data: {
            userId,
            adminId,
            content: trimmedContent,
            isFromAdmin: true,
          },
        })

        return {
          type: 'SUCCESS' as const,
          payload: {
            adminMessage: msg,
            targetUser,
          },
        }
      },
      'admin-messages:post:create'
    )

    if (adminMessage.type === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: '目標用戶不存在' }, { status: 404 })
    }

    const { adminMessage: createdAdminMessage, targetUser } = adminMessage.payload

    // 2) 確保有一個「管理員 <-> 用戶」的 ONE_ON_ONE 聊天室
    let roomId: string | null = null
    try {
      const chatRoomResult = await db.query(
        async (client) => {
          // 找出所有 candidate rooms
          const existingRooms = await (client as any).chatRoom.findMany({
            where: {
              bookingId: null,
              groupBookingId: null,
              multiPlayerBookingId: null,
              type: 'ONE_ON_ONE',
              members: {
                some: {
                  userId: {
                    in: [adminId, userId],
                  },
                },
              },
            },
            include: {
              members: {
                select: { userId: true },
              },
            },
          })

          const existingRoom = existingRooms.find((room: any) => {
            const memberIds = room.members.map((m: any) => m.userId)
            return (
              memberIds.includes(adminId) &&
              memberIds.includes(userId) &&
              memberIds.length === 2
            )
          })

          if (existingRoom) {
            return { roomId: existingRoom.id, created: false as const }
          }

          // 創建新的聊天室（管理員 + 用戶）
          const room = await (client as any).chatRoom.create({
            data: {
              type: 'ONE_ON_ONE',
              bookingId: null,
              groupBookingId: null,
              multiPlayerBookingId: null,
              members: {
                create: [{ userId: adminId }, { userId }],
              },
            },
          })

          return { roomId: room.id, created: true as const }
        },
        'admin-messages:post:ensure-room'
      )

      roomId = chatRoomResult.roomId
    } catch (error) {
      console.error('[admin-messages] 確保聊天室存在時發生錯誤:', error)
      // 不影響 AdminMessage 主流程，繼續往下
    }

    // 3) 如果有 roomId，將同一則訊息送進 ChatMessage（聊天室）
    if (roomId) {
      try {
        const baseUrl =
          process.env.NEXTAUTH_URL ||
          process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` ||
          'http://localhost:3000'

        const chatRes = await fetch(
          `${baseUrl}/api/chat/rooms/${roomId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // 從伺服端呼叫同一個應用，不帶 Cookie 也可以，
              // 因為 messages API 會再從 DB 依 senderId 找 user
            },
            body: JSON.stringify({
              content: trimmedContent,
            }),
          }
        )

        if (!chatRes.ok) {
          const err = await chatRes.json().catch(() => ({}))
          console.warn(
            '[admin-messages] 將訊息同步到聊天室失敗:',
            chatRes.status,
            err
          )
        }
      } catch (error) {
        console.error('[admin-messages] 呼叫聊天室訊息 API 失敗:', error)
        // 不阻斷主流程
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        id: createdAdminMessage.id,
        content: createdAdminMessage.content,
        isRead: createdAdminMessage.isRead,
        isFromAdmin: createdAdminMessage.isFromAdmin,
        createdAt: createdAdminMessage.createdAt,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
        },
        admin: {
          id: adminId,
          name: session.user.name || '管理員',
        },
      },
    })
  } catch (error) {
    return createErrorResponse(error, 'admin-messages:post')
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取管理員私訊
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const result = await db.query(async (client) => {
      if (session.user.role === 'ADMIN') {
        // 管理員查看與特定用戶的對話
        if (!userId) {
          throw new Error('缺少用戶ID');
        }

        const messages = await client.adminMessage.findMany({
          where: {
            userId: userId
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            },
            admin: {
              select: {
                id: true,
                name: true,
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        });

        return { messages };
      } else {
        // 用戶查看與管理員的對話
        const messages = await client.adminMessage.findMany({
          where: {
            userId: session.user.id
          },
          include: {
            admin: {
              select: {
                id: true,
                name: true,
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        });

        return { messages };
      }
    }, 'admin-messages:GET');

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ 獲取管理員私訊失敗:', error);
    if (error instanceof NextResponse) {
      return error;
    }
    return NextResponse.json({
      error: '獲取管理員私訊失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 發送管理員私訊
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, content, isFromAdmin = false } = body;

    if (!content) {
      return NextResponse.json({ error: '訊息內容不能為空' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      let targetUserId = userId;
      let adminId = session.user.id;

      if (session.user.role === 'ADMIN') {
        // 管理員發送訊息
        if (!userId) {
          throw new Error('缺少用戶ID');
        }
        targetUserId = userId;
      } else {
        // 用戶回覆管理員
        targetUserId = session.user.id;
        // 需要找到管理員ID，這裡假設第一個管理員
        const admin = await client.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true }
        });
        if (!admin) {
          throw new Error('找不到管理員');
        }
        adminId = admin.id;
      }

      const message = await client.adminMessage.create({
        data: {
          userId: targetUserId,
          adminId: adminId,
          content,
          isFromAdmin: session.user.role === 'ADMIN',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          admin: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });

      console.log(`✅ 已發送管理員私訊: ${content}`);
      return { 
        message,
        success: true
      };
    }, 'admin-messages:POST');

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ 發送管理員私訊失敗:', error);
    if (error instanceof NextResponse) {
      return error;
    }
    return NextResponse.json({
      error: '發送管理員私訊失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
