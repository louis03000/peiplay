import { NextResponse } from 'next/server';
import { performance } from 'perf_hooks';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache';
import { withRateLimit } from '@/lib/middleware-rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/rooms/[roomId]/messages
 * 獲取聊天室訊息歷史
 * ✅ 關鍵優化：使用 Cache.getOrSet，先查 Redis，MISS 才查 DB
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  const t0 = performance.now();

  try {
    // 【架構修復】添加 rate limiting，防止 API 爆炸
    const rateLimitResult = await withRateLimit(request as any, { 
      preset: 'GENERAL', // 60 次/分鐘
      endpoint: 'chat:rooms:messages:get'
    });
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }

    const session = await getServerSession(authOptions);
    const tAuth = performance.now();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 處理 params 可能是 Promise 的情況（Next.js 15）
    const resolvedParams = params instanceof Promise ? await params : params;
    const { roomId } = resolvedParams;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const cursor = searchParams.get('cursor');

    // ✅ 檢查環境變數
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const redisStatus = (redisUrl && redisToken) ? 'SET' : 'NOT_SET';
    const redisUrlPreview = redisUrl ? `${redisUrl.substring(0, 30)}...` : 'N/A';

    // ✅ 只有最新消息（無 cursor 參數）才使用 Redis List cache
    const useCache = !cursor && redisStatus === 'SET';
    const listKey = useCache ? CacheKeys.chat.messages(roomId) : null;

    // ✅ 使用 Redis List（LRANGE）而不是 SET
    if (listKey) {
      const redisStart = performance.now();
      const cachedMessages = await Cache.listRange<any>(listKey, 0, limit - 1);
      const redisMs = performance.now() - redisStart;

      if (cachedMessages.length > 0) {
        // ✅ Cache HIT：直接返回
        const tEnd = performance.now();
        const totalMs = (tEnd - t0).toFixed(1);
        const authMs = (tAuth - t0).toFixed(1);
        const serverTiming = `auth;dur=${authMs},redis;dur=${redisMs.toFixed(1)},db;dur=0,total;dur=${totalMs}`;

        console.error(`🔥 Redis HIT (List): ${listKey} (${cachedMessages.length} messages) | redis ${redisMs.toFixed(1)}ms | total ${totalMs}ms`);

        return NextResponse.json(
          { messages: cachedMessages, cursor: null },
          {
            status: 200,
            headers: {
              'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
              'X-Cache': 'HIT',
              'X-Redis-Op': 'LRANGE',
              'X-Redis-Status': redisStatus,
              'X-Redis-URL-Preview': redisUrlPreview,
              'X-Redis-Ms': redisMs.toFixed(1),
              'Server-Timing': serverTiming,
              'X-Server-Timing': serverTiming,
              'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Op, X-Redis-Status, X-Redis-URL-Preview, X-Redis-Ms',
            },
          }
        );
      }

      // ❄️ Cache MISS：查 DB 並回填 Redis List
      const dbStart = performance.now();
      try {
        const result = await db.query(async (client) => {
          // ✅ 權限驗證：改為檢查 room 是否存在，以及用戶是否是參與者
          const [room, membership, user] = await Promise.all([
            client.chatRoom.findUnique({
              where: { id: roomId },
              select: {
                id: true,
                bookingId: true,
                groupBookingId: true,
                multiPlayerBookingId: true,
              },
            }),
            client.chatRoomMember.findUnique({
              where: {
                roomId_userId: {
                  roomId,
                  userId: session.user.id,
                },
              },
              select: { id: true },
            }),
            client.user.findUnique({
              where: { id: session.user.id },
              select: { role: true },
            }),
          ]);

          // ✅ 如果 room 不存在，返回 404
          if (!room) {
            throw new Error('聊天室不存在');
          }

          // ✅ 如果用戶是 ADMIN，直接允許
          if (user?.role === 'ADMIN') {
            // 允許訪問
          } else if (membership) {
            // ✅ 如果用戶在 chatRoomMember 中，允許訪問
            // 允許訪問
          } else {
            // ✅ 檢查用戶是否是 room 對應的 booking/groupBooking/multiPlayerBooking 參與者
            let hasAccess = false;

            // 檢查一般預約 (Booking)
            if (room.bookingId) {
              const booking = await client.booking.findUnique({
                where: { id: room.bookingId },
                select: {
                  customerId: true,
                  partnerId: true,
                },
              });
              if (booking) {
                // 檢查用戶是否是顧客或夥伴
                const customer = await client.customer.findUnique({
                  where: { id: booking.customerId },
                  select: { userId: true },
                });
                const partner = await client.partner.findUnique({
                  where: { id: booking.partnerId },
                  select: { userId: true },
                });
                if (customer?.userId === session.user.id || partner?.userId === session.user.id) {
                  hasAccess = true;
                }
              }
            }

            // 檢查群組預約 (GroupBooking)
            if (!hasAccess && room.groupBookingId) {
              // 檢查用戶是否在相關的 Booking 中
              const relatedBooking = await client.booking.findFirst({
                where: {
                  groupBookingId: room.groupBookingId,
                },
                select: {
                  customerId: true,
                  schedule: {
                    select: {
                      partnerId: true,
                    },
                  },
                },
              });
              if (relatedBooking) {
                const customer = await client.customer.findUnique({
                  where: { id: relatedBooking.customerId },
                  select: { userId: true },
                });
                const partner = relatedBooking.schedule
                  ? await client.partner.findUnique({
                      where: { id: relatedBooking.schedule.partnerId },
                      select: { userId: true },
                    })
                  : null;
                if (customer?.userId === session.user.id || partner?.userId === session.user.id) {
                  hasAccess = true;
                }
              }
            }

            // 檢查多人陪玩 (MultiPlayerBooking)
            if (!hasAccess && room.multiPlayerBookingId) {
              const multiPlayerBooking = await client.multiPlayerBooking.findUnique({
                where: { id: room.multiPlayerBookingId },
                select: {
                  customerId: true,
                  bookings: {
                    select: {
                      schedule: {
                        select: {
                          partnerId: true,
                        },
                      },
                    },
                  },
                },
              });
              if (multiPlayerBooking) {
                // 檢查用戶是否是顧客
                const customer = await client.customer.findUnique({
                  where: { id: multiPlayerBooking.customerId },
                  select: { userId: true },
                });
                if (customer?.userId === session.user.id) {
                  hasAccess = true;
                } else {
                  // 檢查用戶是否是任何一個陪玩者
                  for (const booking of multiPlayerBooking.bookings) {
                    if (booking.schedule) {
                      const partner = await client.partner.findUnique({
                        where: { id: booking.schedule.partnerId },
                        select: { userId: true },
                      });
                      if (partner?.userId === session.user.id) {
                        hasAccess = true;
                        break;
                      }
                    }
                  }
                }
              }
            }

            // ✅ membership 驗證失敗時：不可回空陣列，必須回 403
            if (!hasAccess) {
              throw new Error('無權限訪問此聊天室');
            }
          }

          // 查詢訊息
          const messages = await (client as any).$queryRaw`
            SELECT
              id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
            FROM "ChatMessage"
            WHERE "roomId" = ${roomId}
              AND "moderationStatus" != 'REJECTED'
            ORDER BY "createdAt" DESC, id DESC
            LIMIT ${limit}
          `;

          const formattedMessages = (messages as any[]).reverse().map((msg: any) => ({
            id: msg.id,
            roomId: msg.roomId,
            senderId: msg.senderId,
            senderName: msg.senderName || null,
            senderAvatarUrl: msg.senderAvatarUrl || null,
            content: msg.content,
            contentType: 'TEXT' as const,
            status: 'SENT' as const,
            moderationStatus: 'APPROVED' as const,
            createdAt: msg.createdAt,
            sender: {
              id: msg.senderId,
              name: msg.senderName || null,
              email: '',
              role: '',
              avatarUrl: msg.senderAvatarUrl || null,
            },
          }));

          return {
            messages: formattedMessages,
            cursor: null,
          };
        }, 'chat:rooms:roomId:messages:get');

        const dbMs = performance.now() - dbStart;
        const messages = result.messages || [];

        // ✅ 禁止 cache 空訊息結果：messages.length === 0 時不要回填 Redis List
        // 🟩 回填 Redis List（背景執行，不阻塞回應）
        if (messages.length > 0) {
          // 清空舊的並回填（從右邊推入，保持時間順序）
          Cache.delete(listKey)
            .then(() => Cache.listPushRight(listKey, ...messages))
            .then(() => Cache.listTrim(listKey, 0, 49)) // 只保留最近 50 則
            .catch((error: any) => {
              console.error(`⚠️ Failed to backfill Redis List for ${listKey}:`, error.message);
            });
        }

        const tEnd = performance.now();
        const totalMs = (tEnd - t0).toFixed(1);
        const authMs = (tAuth - t0).toFixed(1);
        const serverTiming = `auth;dur=${authMs},redis;dur=${redisMs.toFixed(1)},db;dur=${dbMs.toFixed(1)},total;dur=${totalMs}`;

        console.error(`❄️ Redis MISS (List): ${listKey} | redis ${redisMs.toFixed(1)}ms | db ${dbMs.toFixed(1)}ms | total ${totalMs}ms`);

        return NextResponse.json(
          { messages, cursor: null },
          {
            status: 200,
            headers: {
              'Cache-Control': 'private, max-age=1, stale-while-revalidate=2',
              'X-Cache': 'MISS',
              'X-Redis-Op': 'LRANGE',
              'X-Redis-Status': redisStatus,
              'X-Redis-URL-Preview': redisUrlPreview,
              'X-Redis-Ms': redisMs.toFixed(1),
              'X-Db-Ms': dbMs.toFixed(1),
              'Server-Timing': serverTiming,
              'X-Server-Timing': serverTiming,
              'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Op, X-Redis-Status, X-Redis-URL-Preview, X-Redis-Ms, X-Db-Ms',
            },
          }
        );
      } catch (error: any) {
        console.error(`⚠️ DB query error:`, error.message);
        // ✅ membership 驗證失敗時：不可回空陣列，必須回 403，不可被 Redis cache
        if (error.message === '無權限訪問此聊天室' || error.message === '聊天室不存在') {
          return NextResponse.json(
            { error: error.message },
            { status: error.message === '聊天室不存在' ? 404 : 403 }
          );
        }
        // Fall through to DB query below
      }
    }

    // ✅ 沒有 cache key 或 Redis 不可用，直接查 DB
    const dbStart = performance.now();
    const result = await db.query(async (client) => {
      // ✅ 權限驗證：改為檢查 room 是否存在，以及用戶是否是參與者
      const [room, membership, user] = await Promise.all([
        client.chatRoom.findUnique({
          where: { id: roomId },
          select: {
            id: true,
            bookingId: true,
            groupBookingId: true,
            multiPlayerBookingId: true,
          },
        }),
        client.chatRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: session.user.id,
            },
          },
          select: { id: true },
        }),
        client.user.findUnique({
          where: { id: session.user.id },
          select: { role: true },
        }),
      ]);

      // ✅ 如果 room 不存在，返回 404
      if (!room) {
        throw new Error('聊天室不存在');
      }

      // ✅ 如果用戶是 ADMIN，直接允許
      if (user?.role === 'ADMIN') {
        // 允許訪問
      } else if (membership) {
        // ✅ 如果用戶在 chatRoomMember 中，允許訪問
        // 允許訪問
      } else {
        // ✅ 檢查用戶是否是 room 對應的 booking/groupBooking/multiPlayerBooking 參與者
        let hasAccess = false;

        // 檢查一般預約 (Booking)
        if (room.bookingId) {
          const booking = await client.booking.findUnique({
            where: { id: room.bookingId },
            select: {
              customerId: true,
              partnerId: true,
            },
          });
          if (booking) {
            // 檢查用戶是否是顧客或夥伴
            const customer = await client.customer.findUnique({
              where: { id: booking.customerId },
              select: { userId: true },
            });
            const partner = await client.partner.findUnique({
              where: { id: booking.partnerId },
              select: { userId: true },
            });
            if (customer?.userId === session.user.id || partner?.userId === session.user.id) {
              hasAccess = true;
            }
          }
        }

        // 檢查群組預約 (GroupBooking)
        if (!hasAccess && room.groupBookingId) {
          const groupBooking = await client.groupBooking.findUnique({
            where: { id: room.groupBookingId },
            select: { id: true },
          });
          if (groupBooking) {
            // 檢查用戶是否在相關的 Booking 中
            const relatedBooking = await client.booking.findFirst({
              where: {
                groupBookingId: room.groupBookingId,
              },
              select: {
                customerId: true,
                schedule: {
                  select: {
                    partnerId: true,
                  },
                },
              },
            });
            if (relatedBooking) {
              const customer = await client.customer.findUnique({
                where: { id: relatedBooking.customerId },
                select: { userId: true },
              });
              const partner = relatedBooking.schedule
                ? await client.partner.findUnique({
                    where: { id: relatedBooking.schedule.partnerId },
                    select: { userId: true },
                  })
                : null;
              if (customer?.userId === session.user.id || partner?.userId === session.user.id) {
                hasAccess = true;
              }
            }
          }
        }

        // 檢查多人陪玩 (MultiPlayerBooking)
        if (!hasAccess && room.multiPlayerBookingId) {
          const multiPlayerBooking = await client.multiPlayerBooking.findUnique({
            where: { id: room.multiPlayerBookingId },
            select: {
              customerId: true,
              bookings: {
                select: {
                  schedule: {
                    select: {
                      partnerId: true,
                    },
                  },
                },
              },
            },
          });
          if (multiPlayerBooking) {
            // 檢查用戶是否是顧客
            const customer = await client.customer.findUnique({
              where: { id: multiPlayerBooking.customerId },
              select: { userId: true },
            });
            if (customer?.userId === session.user.id) {
              hasAccess = true;
            } else {
              // 檢查用戶是否是任何一個陪玩者
              for (const booking of multiPlayerBooking.bookings) {
                if (booking.schedule) {
                  const partner = await client.partner.findUnique({
                    where: { id: booking.schedule.partnerId },
                    select: { userId: true },
                  });
                  if (partner?.userId === session.user.id) {
                    hasAccess = true;
                    break;
                  }
                }
              }
            }
          }
        }

        // ✅ membership 驗證失敗時：不可回空陣列，必須回 403
        if (!hasAccess) {
          throw new Error('無權限訪問此聊天室');
        }
      }

      // 查詢訊息
      let messages: any[];

      if (cursor) {
        const cursorDate = new Date(cursor);
        messages = await (client as any).$queryRaw`
          SELECT
            id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
          FROM "ChatMessage"
          WHERE "roomId" = ${roomId}
            AND "moderationStatus" != 'REJECTED'
            AND ("createdAt" < ${cursorDate} OR ("createdAt" = ${cursorDate} AND id < ${cursor.split(':')[1] || ''}))
          ORDER BY "createdAt" DESC, id DESC
          LIMIT ${limit}
        `;
      } else {
        messages = await (client as any).$queryRaw`
          SELECT
            id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
          FROM "ChatMessage"
          WHERE "roomId" = ${roomId}
            AND "moderationStatus" != 'REJECTED'
          ORDER BY "createdAt" DESC, id DESC
          LIMIT ${limit}
        `;
      }

      const formattedMessages = (messages as any[]).reverse().map((msg: any) => ({
        id: msg.id,
        roomId: msg.roomId,
        senderId: msg.senderId,
        senderName: msg.senderName || null,
        senderAvatarUrl: msg.senderAvatarUrl || null,
        content: msg.content,
        contentType: 'TEXT' as const,
        status: 'SENT' as const,
        moderationStatus: 'APPROVED' as const,
        createdAt: msg.createdAt,
        sender: {
          id: msg.senderId,
          name: msg.senderName || null,
          email: '',
          role: '',
          avatarUrl: msg.senderAvatarUrl || null,
        },
      }));

      const nextCursor = formattedMessages.length > 0
        ? `${formattedMessages[formattedMessages.length - 1].createdAt}:${formattedMessages[formattedMessages.length - 1].id}`
        : null;

      return {
        messages: formattedMessages,
        cursor: nextCursor,
      };
    }, 'chat:rooms:roomId:messages:get');
    const dbDone = performance.now();
    const dbMs = dbDone - dbStart;

    const messages = (result as any)?.messages || result || [];
    const nextCursor = (result as any)?.cursor || null;
    const tEnd = performance.now();
    const authMs = (tAuth - t0).toFixed(1);
    const dbMsFormatted = dbMs.toFixed(1);
    const totalMs = (tEnd - t0).toFixed(1);
    const serverTiming = `auth;dur=${authMs},redis;dur=0,db;dur=${dbMsFormatted},total;dur=${totalMs}`;
    
    console.error(`[MESSAGES API] ⏱️ FINAL: room=${roomId} auth=${authMs}ms db=${dbMsFormatted}ms total=${totalMs}ms cache=SKIP`);

    return NextResponse.json(
      { messages, cursor: nextCursor },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=3, stale-while-revalidate=5',
          'X-Cache': 'SKIP',
          'X-Redis-Status': redisStatus,
          'X-Redis-URL-Preview': redisUrlPreview,
          'Server-Timing': serverTiming,
          'X-Server-Timing': serverTiming,
          'Access-Control-Expose-Headers': 'Server-Timing, X-Server-Timing, X-Cache, X-Redis-Status, X-Redis-URL-Preview',
        },
      }
    );
  } catch (error: any) {
    // ✅ membership 驗證失敗時：不可回空陣列，必須回 403，不可被 Redis cache
    if (error?.message === '無權限訪問此聊天室' || error?.message === '聊天室不存在') {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === '聊天室不存在' ? 404 : 403 }
      );
    }
    return createErrorResponse(error, 'chat:rooms:roomId:messages:get');
  }
}

/**
 * POST /api/chat/rooms/[roomId]/messages
 * 發送訊息
 * ✅ 關鍵優化：Write-through cache（寫入 DB 後同步更新 Redis List）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    // 【架構修復】添加 rate limiting，防止寫入 API 爆炸
    const rateLimitResult = await withRateLimit(request as any, { 
      preset: 'GENERAL', // 60 次/分鐘
      endpoint: 'chat:rooms:messages:post'
    });
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }

    const session = await getServerSession(authOptions);

    // ✅ 檢查 session 和 user
    if (!session?.user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // ✅ 在 POST 一開始 console.log(session.user) 用於調試
    console.log('[POST /api/chat/rooms/[roomId]/messages] session.user:', session.user);

    // ✅ 確保 session.user.id 存在，如果不存在則嘗試使用 email 查找用戶
    let senderId: string | undefined = session.user.id;
    
    if (!senderId) {
      // 如果沒有 id，嘗試使用 email 查找用戶
      if (session.user.email) {
        try {
          const userByEmail = await db.query(async (client) => {
            return await client.user.findUnique({
              where: { email: session.user.email! },
              select: { id: true },
            });
          }, 'chat:rooms:roomId:messages:post:find-user-by-email');
          
          if (userByEmail?.id) {
            senderId = userByEmail.id;
            console.log('[POST /api/chat/rooms/[roomId]/messages] Found user by email:', senderId);
          } else {
            return NextResponse.json({ error: '無法識別用戶，請重新登入' }, { status: 401 });
          }
        } catch (error) {
          console.error('[POST /api/chat/rooms/[roomId]/messages] Error finding user by email:', error);
          return NextResponse.json({ error: '無法識別用戶，請重新登入' }, { status: 401 });
        }
      } else {
        return NextResponse.json({ error: '無法識別用戶，請重新登入' }, { status: 401 });
      }
    }

    // ✅ 確保 senderId 不是 undefined
    if (!senderId) {
      return NextResponse.json({ error: '無法識別用戶，請重新登入' }, { status: 401 });
    }

    // 處理 params 可能是 Promise 的情況（Next.js 15）
    const resolvedParams = params instanceof Promise ? await params : params;
    const { roomId } = resolvedParams;

    // ✅ 確保 roomId 不是 undefined
    if (!roomId) {
      return NextResponse.json({ error: '聊天室 ID 不能為空' }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: '訊息內容不能為空' }, { status: 400 });
    }

    // 檢查 Redis 狀態
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const redisStatus = (redisUrl && redisToken) ? 'SET' : 'NOT_SET';

    // ✅ 先檢查免費聊天限制（在 db.query 外部）
    // ✅ 確保不會 throw Error，而是返回適當的錯誤碼
    let roomCheck: any = null;
    try {
      roomCheck = await db.query(async (client) => {
        // ✅ 確保 roomId 和 senderId 都不是 undefined 才查詢
        if (!roomId || !senderId) {
          return null;
        }

        const [membership, room] = await Promise.all([
          client.chatRoomMember.findUnique({
            where: {
              roomId_userId: {
                roomId,
                userId: senderId,
              },
            },
            select: { id: true },
          }),
          client.chatRoom.findUnique({
            where: { id: roomId },
            select: {
              id: true,
              bookingId: true,
              groupBookingId: true,
              multiPlayerBookingId: true,
            },
          }),
        ]);

        // ✅ membership 或 room 不存在時返回 null，不要 throw Error
        if (!membership) {
          return null; // 會在外部處理，返回 403
        }

        if (!room) {
          return null; // 會在外部處理，返回 404
        }

        return room;
      }, 'chat:rooms:roomId:messages:post:check');
    } catch (error: any) {
      // ✅ 資料庫錯誤時返回 500，但記錄詳細信息
      console.error('[POST /api/chat/rooms/[roomId]/messages] roomCheck error:', error);
      return NextResponse.json({ error: '檢查聊天室權限時發生錯誤' }, { status: 500 });
    }

    // ✅ roomCheck 不存在時不要 throw，返回適當的錯誤碼
    if (!roomCheck) {
      // 再次查詢確認是 membership 還是 room 不存在
      try {
        const [membershipCheck, roomCheckOnly] = await Promise.all([
          db.query(async (client) => {
            if (!roomId || !senderId) return null;
            return await client.chatRoomMember.findUnique({
              where: {
                roomId_userId: {
                  roomId,
                  userId: senderId,
                },
              },
              select: { id: true },
            });
          }, 'chat:rooms:roomId:messages:post:check-membership'),
          db.query(async (client) => {
            if (!roomId) return null;
            return await client.chatRoom.findUnique({
              where: { id: roomId },
              select: { id: true },
            });
          }, 'chat:rooms:roomId:messages:post:check-room'),
        ]);

        if (!roomCheckOnly) {
          return NextResponse.json({ error: '聊天室不存在' }, { status: 404 });
        }

        if (!membershipCheck) {
          return NextResponse.json({ error: '無權限訪問此聊天室' }, { status: 403 });
        }

        // 如果都存在但 roomCheck 為 null，可能是其他問題
        return NextResponse.json({ error: '無法訪問此聊天室' }, { status: 403 });
      } catch (error: any) {
        console.error('[POST /api/chat/rooms/[roomId]/messages] Error checking membership/room:', error);
        return NextResponse.json({ error: '檢查聊天室權限時發生錯誤' }, { status: 500 });
      }
    }

    const isFreeChat =
      !roomCheck?.bookingId && !roomCheck?.groupBookingId && !roomCheck?.multiPlayerBookingId;

    // 免費聊天限制檢查（每日重置）
    if (isFreeChat) {
      // 使用 dayjs 計算今天開始的 UTC 時間（台灣時區）
      const dayjs = (await import('dayjs')).default;
      const utc = (await import('dayjs/plugin/utc')).default;
      const timezone = (await import('dayjs/plugin/timezone')).default;
      dayjs.extend(utc);
      dayjs.extend(timezone);
      
      // 獲取台灣時區今天的開始時間，然後轉換為 UTC
      const todayStartTaipei = dayjs.tz('Asia/Taipei').startOf('day');
      const todayStartUTCForDB = todayStartTaipei.utc().toDate();

      // ✅ 確保 roomId 和 senderId 都不是 undefined
      if (!roomId || !senderId) {
        return NextResponse.json({ error: '參數錯誤' }, { status: 400 });
      }

      const todayMessages = await db.query(async (client) => {
        return await client.chatMessage.findMany({
          where: {
            roomId,
            senderId: senderId,
            createdAt: {
              gte: todayStartUTCForDB, // 只計算今天的消息
            },
          },
          select: { id: true },
        });
      }, 'chat:rooms:roomId:messages:post:check-limit');

      const FREE_CHAT_LIMIT = 5;
      if (todayMessages.length >= FREE_CHAT_LIMIT) {
        // 返回 403 而不是 500，因為這是業務邏輯限制，不是伺服器錯誤
        return NextResponse.json(
          { 
            error: `免費聊天句數上限為${FREE_CHAT_LIMIT}句，您已達到今日上限。每日凌晨 00:00 會重新計算。`,
            limitReached: true,
            used: todayMessages.length,
            limit: FREE_CHAT_LIMIT
          },
          { status: 403 }
        );
      }
    }

    // ✅ 確保 roomId 和 senderId 都不是 undefined 才進行 Prisma 查詢
    if (!roomId || !senderId) {
      return NextResponse.json({ error: '參數錯誤' }, { status: 400 });
    }

    // ✅ 確保 Redis cache 操作只在 DB 寫入成功後才執行
    const result = await db.query(async (client) => {
      // ✅ 獲取使用者資訊（確保 senderId 不是 undefined）
      const user = await client.user.findUnique({
        where: { id: senderId },
        select: {
          name: true,
          partner: {
            select: {
              coverImage: true,
            },
          },
        },
      });

      const avatarUrl = user?.partner?.coverImage || null;
      const senderName = user?.name || session.user.email || '未知用戶';

      // 內容過濾
      const blockedKeywords = ['垃圾', 'spam'];
      const hasBlockedKeyword = blockedKeywords.some((keyword) =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      // ✅ 寫入訊息並更新 ChatRoom.lastMessageAt
      // ✅ chatMessage.create 前保證 FK 合法：roomId 和 senderId 都已經驗證不是 undefined
      const message = await client.$transaction(async (tx) => {
        const newMessage = await tx.chatMessage.create({
          data: {
            roomId: roomId, // ✅ 已確保不是 undefined
            senderId: senderId, // ✅ 已確保不是 undefined
            senderName: senderName,
            senderAvatarUrl: avatarUrl,
            content: content.trim(),
            contentType: 'TEXT',
            status: 'SENT',
            moderationStatus: hasBlockedKeyword ? 'FLAGGED' : 'APPROVED',
          },
          select: {
            id: true,
            roomId: true,
            senderId: true,
            senderName: true,
            senderAvatarUrl: true,
            content: true,
            contentType: true,
            status: true,
            moderationStatus: true,
            createdAt: true,
          },
        });

        await tx.chatRoom.update({
          where: { id: roomId },
          data: { lastMessageAt: newMessage.createdAt },
        });

        return newMessage;
      });

      return {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderAvatarUrl: message.senderAvatarUrl,
        content: message.content,
        contentType: message.contentType,
        status: message.status,
        moderationStatus: message.moderationStatus,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.senderId,
          name: message.senderName,
          email: '',
          role: '',
          avatarUrl: message.senderAvatarUrl,
        },
      };
    }, 'chat:rooms:roomId:messages:post');

    // ✅ 成功 → 一定回 messageId：確保 result 存在且有 id
    if (!result || !result.id) {
      console.error('[POST /api/chat/rooms/[roomId]/messages] ❌ DB 寫入失敗：result 為空或沒有 id', result);
      return NextResponse.json(
        { error: '訊息發送失敗，請重試' },
        { status: 500 }
      );
    }

    // ✅ 確保 Redis cache 操作只在 DB 寫入成功後才執行
    // ✅ Write-through cache：同步更新 Redis List（只在 DB 成功後執行）
    if (redisStatus === 'SET' && result.id) {
      const listKey = CacheKeys.chat.messages(roomId);
      
      // 格式化訊息（與 GET API 格式一致）
      const formattedMessage = {
        id: result.id,
        roomId: result.roomId,
        senderId: result.senderId,
        senderName: result.senderName || null,
        senderAvatarUrl: result.senderAvatarUrl || null,
        content: result.content,
        contentType: result.contentType || 'TEXT',
        status: result.status || 'SENT',
        moderationStatus: result.moderationStatus || 'APPROVED',
        createdAt: result.createdAt,
        sender: result.sender,
      };

      // 從左邊推入新訊息（最新的在最前面）
      Cache.listPush(listKey, formattedMessage)
        .then(() => Cache.listTrim(listKey, 0, 49)) // 只保留最近 50 則
        .then(() => {
          console.error(`✅ Write-through cache: ${listKey} updated with new message`);
        })
        .catch((error: any) => {
          console.error(`⚠️ Failed to update Redis List for ${listKey}:`, error.message);
        });

      // 同時清除 meta cache（讓 meta polling 知道有新訊息）
      Cache.delete(CacheKeys.chat.meta(roomId)).catch(() => {});
    }

    // ✅ 成功 → 一定回 messageId
    return NextResponse.json({ 
      message: result,
      messageId: result.id // ✅ 確保返回 messageId
    });
  } catch (error: any) {
    // ✅ Prisma 失敗 → 回 500
    console.error('[POST /api/chat/rooms/[roomId]/messages] ❌ Error:', error);
    
    // ✅ 未登入 → 回 401（如果 session 檢查失敗）
    if (error?.message?.includes('請先登入') || error?.message?.includes('無法識別用戶')) {
      return NextResponse.json(
        { error: error.message || '請先登入' },
        { status: 401 }
      );
    }
    
    // ✅ Prisma 失敗 → 回 500
    if (error?.code || error?.message?.includes('Prisma') || error?.message?.includes('database')) {
      return NextResponse.json(
        { error: '訊息發送失敗，資料庫錯誤' },
        { status: 500 }
      );
    }
    
    return createErrorResponse(error, 'chat:rooms:roomId:messages:post');
  }
}
