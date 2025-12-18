import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";
import { Cache, CacheKeys, CacheTTL } from "@/lib/redis-cache";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 輕量級夥伴列表 API（預約 Step 1）
 * 
 * 只返回基本資料，不查時段、不驗證可約性
 * 時段查詢應該在 Step 2 使用 /api/partners/[id]/schedules
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const availableNow = url.searchParams.get("availableNow") === 'true';
    const rankBooster = url.searchParams.get("rankBooster") === 'true';
    const game = url.searchParams.get("game")?.trim() || '';

    // 生成快取 key
    const cacheParams = {
      availableNow: availableNow ? 'true' : 'false',
      rankBooster: rankBooster ? 'true' : 'false',
      game: game || '',
    };
    const cacheKey = CacheKeys.partners.list(cacheParams) + ':lightweight';

    // 使用 Redis 快取（對於「現在有空」使用更短的快取時間，確保即時性）
    const cacheTTL = availableNow ? 10 : CacheTTL.SHORT; // 10秒 vs 30秒
    const partners = await Cache.getOrSet(
      cacheKey,
      async () => {
        return await db.query(
          async (client) => {
            const now = new Date();
            console.log('[partners/list] 查詢條件:', { availableNow, rankBooster, game, now: now.toISOString() });

            // 輕量級查詢：只查基本資料
            let partnerWhere: any = {
              status: 'APPROVED',
              ...(rankBooster ? { isRankBooster: true } : {}),
              ...(availableNow ? { isAvailableNow: true } : {}),
              // 注意：停權用戶過濾在應用層處理，避免 OR 條件影響索引
            };
            console.log('[partners/list] partnerWhere:', JSON.stringify(partnerWhere, null, 2));

            // 如果篩選「現在有空」，排除有活躍預約的夥伴
            if (availableNow) {
              // 查詢正在進行中或即將開始的預約（開始時間 <= 現在，結束時間 >= 現在）
              const busyBookings = await client.booking.findMany({
                where: {
                  status: {
                    in: ['PENDING', 'CONFIRMED', 'PAID_WAITING_PARTNER_CONFIRMATION', 'PARTNER_ACCEPTED'],
                  },
                  schedule: {
                    startTime: { lte: now },
                    endTime: { gte: now },
                  },
                },
                select: {
                  partnerId: true,
                },
                distinct: ['partnerId'],
                take: 200,
              });

              const partnerIds = busyBookings.map((b) => b.partnerId).filter(Boolean);
              if (partnerIds.length > 0) {
                partnerWhere.id = {
                  notIn: partnerIds,
                };
              }
            }

            const allPartners = await client.partner.findMany({
              where: partnerWhere,
              select: {
                id: true,
                name: true,
                games: true,
                halfHourlyRate: true,
                coverImage: true,
                images: true,
                rankBoosterImages: true,
                isAvailableNow: true,
                availableNowSince: true,
                isRankBooster: true,
                allowGroupBooking: true,
                rankBoosterNote: true,
                rankBoosterRank: true,
                customerMessage: true,
                supportsChatOnly: true,
                chatOnlyRate: true,
                user: {
                  select: {
                    isSuspended: true,
                    suspensionEndsAt: true,
                  },
                },
                // ❌ 不查 schedules - 這是關鍵優化
              },
              orderBy: { createdAt: 'desc' },
              take: 100, // 限制結果數量
            });
            console.log('[partners/list] 查詢到的夥伴數量:', allPartners.length);

            // 應用層過濾：排除被停權的用戶，以及「現在有空」超過30分鐘的夥伴
            const filtered = allPartners.filter(partner => {
              if (!partner.user) {
                console.log('[partners/list] 過濾：沒有用戶資料', partner.id);
                return false; // 沒有用戶資料的夥伴不顯示
              }
              if (partner.user.isSuspended) {
                const endsAt = partner.user.suspensionEndsAt;
                if (endsAt && endsAt > now) {
                  console.log('[partners/list] 過濾：被停權', partner.id);
                  return false;
                }
              }
              
              // 如果篩選「現在有空」，檢查 availableNowSince 是否在30分鐘內
              // 如果 availableNowSince 為 null，可能是舊數據，允許顯示
              if (availableNow && partner.isAvailableNow) {
                if (partner.availableNowSince) {
                  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
                  const availableSince = new Date(partner.availableNowSince);
                  if (availableSince < thirtyMinutesAgo) {
                    console.log('[partners/list] 過濾：超過30分鐘', partner.id, {
                      availableSince: availableSince.toISOString(),
                      thirtyMinutesAgo: thirtyMinutesAgo.toISOString()
                    });
                    return false; // 超過30分鐘，不顯示
                  }
                }
                // 如果 availableNowSince 為 null，允許顯示（可能是舊數據或手動設置）
                console.log('[partners/list] 通過過濾：現在有空', partner.id, {
                  isAvailableNow: partner.isAvailableNow,
                  availableNowSince: partner.availableNowSince
                });
              }
              
              return true;
            });
            console.log('[partners/list] 過濾後的夥伴數量:', filtered.length);
            return filtered;
          },
          'partners:list:lightweight'
        );
      },
      cacheTTL // 根據是否篩選「現在有空」使用不同的快取時間（10秒 vs 30秒）
    );

    // 應用層過濾遊戲（避免資料庫層面的複雜查詢）
    const filtered = game
      ? partners.filter(partner => {
          const lower = game.toLowerCase();
          return partner.games.some((g) => g.toLowerCase().includes(lower));
        })
      : partners;

    // 格式化圖片
    const processed = filtered.map((partner) => {
      let images = partner.images ?? [];
      if ((!images || images.length === 0) && partner.coverImage) {
        images = [partner.coverImage];
      }
      if (partner.isRankBooster && partner.rankBoosterImages?.length) {
        images = [...images, ...partner.rankBoosterImages];
      }
      images = images.slice(0, 8);

      return {
        id: partner.id,
        name: partner.name,
        games: partner.games,
        halfHourlyRate: partner.halfHourlyRate,
        isAvailableNow: partner.isAvailableNow,
        isRankBooster: partner.isRankBooster,
        allowGroupBooking: partner.allowGroupBooking,
        rankBoosterNote: partner.rankBoosterNote,
        rankBoosterRank: partner.rankBoosterRank,
        customerMessage: partner.customerMessage,
        supportsChatOnly: partner.supportsChatOnly,
        chatOnlyRate: partner.chatOnlyRate,
        images,
        // 不返回 schedules
        schedules: [], // 空陣列，時段需要另外查詢
      };
    });

    return NextResponse.json(processed, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'partners:list:lightweight');
  }
}

