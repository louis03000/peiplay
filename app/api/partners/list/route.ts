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

    // 使用 Redis 快取（統一使用較短的快取時間，確保「現在有空」和「上分高手」標籤能快速顯示）
    // 即使沒有勾選篩選，也要快速顯示標籤，所以統一使用 10 秒緩存
    const cacheTTL = 10; // 統一使用 10 秒，確保標籤即時顯示
    const partners = await Cache.getOrSet(
      cacheKey,
      async () => {
        return await db.query(
          async (client) => {
            const now = new Date();
            console.log('[partners/list] 查詢條件:', { availableNow, rankBooster, game, now: now.toISOString() });

            // 輕量級查詢：只查基本資料
            // 注意：當 availableNow 為 true 時，我們仍然需要先查詢所有 isAvailableNow: true 的夥伴
            // 然後在應用層過濾掉有活躍預約的，這樣可以確保邏輯正確
            let partnerWhere: any = {
              status: 'APPROVED',
              ...(rankBooster ? { isRankBooster: true } : {}),
              ...(availableNow ? { isAvailableNow: true } : {}),
              // 注意：停權用戶過濾在應用層處理，避免 OR 條件影響索引
            };
            console.log('[partners/list] partnerWhere:', JSON.stringify(partnerWhere, null, 2));
            console.log('[partners/list] 篩選條件:', { availableNow, rankBooster });

            // 查詢有活躍預約的夥伴（無論是否開啟篩選器，都需要這個信息）
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

            const busyPartnerIds = busyBookings.map((b) => b.partnerId).filter(Boolean) as string[];
            console.log('[partners/list] 有活躍預約的夥伴數量:', busyPartnerIds.length, 'IDs:', busyPartnerIds);

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
                userId: true, // 用於查詢評價
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

            // 批量查詢所有夥伴的平均星等（優化：避免 N+1 查詢）
            const userIds = allPartners.map(p => p.userId).filter(Boolean) as string[];
            let avgRatingsMap = new Map<string, { averageRating: number; totalReviews: number }>();
            
            if (userIds.length > 0) {
              const reviews = await client.review.groupBy({
                by: ['revieweeId'],
                where: {
                  revieweeId: { in: userIds },
                  isApproved: true, // 只計算已批准的評價
                },
                _avg: {
                  rating: true,
                },
                _count: {
                  id: true,
                },
              });
              
              avgRatingsMap = new Map(
                reviews.map(r => [
                  r.revieweeId,
                  {
                    averageRating: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : 0,
                    totalReviews: r._count.id,
                  }
                ])
              );
            }

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
              
              // 無論是否開啟篩選器，都要驗證「現在有空」狀態，確保標籤正確顯示
              // 如果 isAvailableNow 為 true，需要滿足以下條件：
              // 1. 不能有活躍預約
              // 2. availableNowSince 必須在30分鐘內（如果存在）
              if (partner.isAvailableNow) {
                // 檢查是否有活躍預約
                if (busyPartnerIds.includes(partner.id)) {
                  console.log('[partners/list] 過濾：有活躍預約，不應顯示「現在有空」', partner.id, partner.name);
                  // 如果有活躍預約，將 isAvailableNow 設為 false（但不過濾掉夥伴，只是不顯示標籤）
                  // 注意：這裡不能直接修改 partner 對象，需要在返回時處理
                }
                
                // 檢查 availableNowSince 是否在30分鐘內
                if (partner.availableNowSince) {
                  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
                  const availableSince = new Date(partner.availableNowSince);
                  if (availableSince < thirtyMinutesAgo) {
                    console.log('[partners/list] 過濾：超過30分鐘，不應顯示「現在有空」', partner.id, partner.name, {
                      availableSince: availableSince.toISOString(),
                      thirtyMinutesAgo: thirtyMinutesAgo.toISOString()
                    });
                    // 超過30分鐘，將 isAvailableNow 設為 false（但不過濾掉夥伴，只是不顯示標籤）
                    // 注意：這裡不能直接修改 partner 對象，需要在返回時處理
                  }
                }
              }
              
              // 如果篩選「現在有空」，需要滿足以下條件：
              // 1. isAvailableNow 必須為 true
              // 2. 不能有活躍預約
              // 3. availableNowSince 必須在30分鐘內（如果存在）
              if (availableNow) {
                // 首先檢查 isAvailableNow（雖然資料庫已經過濾，但這裡再次確認）
                if (!partner.isAvailableNow) {
                  console.log('[partners/list] 過濾：isAvailableNow 為 false', partner.id, partner.name);
                  return false;
                }
                
                // 檢查是否有活躍預約
                if (busyPartnerIds.includes(partner.id)) {
                  console.log('[partners/list] 過濾：有活躍預約', partner.id, partner.name);
                  return false;
                }
                
                // 檢查 availableNowSince 是否在30分鐘內
                if (partner.availableNowSince) {
                  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
                  const availableSince = new Date(partner.availableNowSince);
                  if (availableSince < thirtyMinutesAgo) {
                    console.log('[partners/list] 過濾：超過30分鐘', partner.id, partner.name, {
                      availableSince: availableSince.toISOString(),
                      thirtyMinutesAgo: thirtyMinutesAgo.toISOString()
                    });
                    return false; // 超過30分鐘，不顯示
                  }
                }
                // 如果 availableNowSince 為 null，允許顯示（可能是舊數據或手動設置）
                console.log('[partners/list] ✅ 通過過濾：現在有空', partner.id, partner.name, {
                  isAvailableNow: partner.isAvailableNow,
                  availableNowSince: partner.availableNowSince,
                  hasBusyBooking: busyPartnerIds.includes(partner.id)
                });
              }
              
              return true;
            });
            console.log('[partners/list] 過濾後的夥伴數量:', filtered.length);
            return { partners: filtered, avgRatingsMap };
          },
          'partners:list:lightweight'
        );
      },
      cacheTTL // 統一使用 10 秒緩存，確保「現在有空」和「上分高手」標籤快速顯示
    );

    // 應用層過濾遊戲（避免資料庫層面的複雜查詢）
    const { partners: allPartnersData, avgRatingsMap } = partners;
    const filtered = game
      ? allPartnersData.filter(partner => {
          const lower = game.toLowerCase();
          return partner.games.some((g) => g.toLowerCase().includes(lower));
        })
      : allPartnersData;

    // 格式化圖片並添加平均星等
    const processed = filtered.map((partner) => {
      let images = partner.images ?? [];
      if ((!images || images.length === 0) && partner.coverImage) {
        images = [partner.coverImage];
      }
      if (partner.isRankBooster && partner.rankBoosterImages?.length) {
        images = [...images, ...partner.rankBoosterImages];
      }
      images = images.slice(0, 8);

      // 獲取平均星等
      const ratingData = avgRatingsMap.get(partner.userId) || { averageRating: 0, totalReviews: 0 };

      // 驗證「現在有空」狀態：即使 isAvailableNow 為 true，也要檢查是否有活躍預約和時間限制
      let isAvailableNow = !!partner.isAvailableNow;
      if (isAvailableNow) {
        // 檢查是否有活躍預約
        if (busyPartnerIds.includes(partner.id)) {
          isAvailableNow = false;
          console.log('[partners/list] 修正：有活躍預約，將 isAvailableNow 設為 false', partner.id, partner.name);
        }
        
        // 檢查 availableNowSince 是否在30分鐘內
        if (partner.availableNowSince) {
          const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
          const availableSince = new Date(partner.availableNowSince);
          if (availableSince < thirtyMinutesAgo) {
            isAvailableNow = false;
            console.log('[partners/list] 修正：超過30分鐘，將 isAvailableNow 設為 false', partner.id, partner.name);
          }
        }
      }

      const result = {
        id: partner.id,
        name: partner.name,
        games: partner.games,
        halfHourlyRate: partner.halfHourlyRate,
        isAvailableNow: isAvailableNow, // 使用驗證後的狀態
        isRankBooster: !!partner.isRankBooster, // 確保是 boolean
        allowGroupBooking: partner.allowGroupBooking,
        rankBoosterNote: partner.rankBoosterNote,
        rankBoosterRank: partner.rankBoosterRank,
        customerMessage: partner.customerMessage,
        supportsChatOnly: partner.supportsChatOnly,
        chatOnlyRate: partner.chatOnlyRate,
        images,
        averageRating: ratingData.averageRating,
        totalReviews: ratingData.totalReviews,
        // 不返回 schedules
        schedules: [], // 空陣列，時段需要另外查詢
      };
      
      // 調試：記錄所有夥伴的狀態（用於診斷）
      if (result.isAvailableNow || partner.isAvailableNow) {
        console.log('[partners/list] 夥伴狀態:', result.name, {
          isAvailableNow: result.isAvailableNow,
          rawIsAvailableNow: partner.isAvailableNow,
          hasBusyBooking: busyPartnerIds.includes(partner.id),
          availableNowSince: partner.availableNowSince
        });
      }
      
      return result;
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

