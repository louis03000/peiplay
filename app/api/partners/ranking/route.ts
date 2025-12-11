import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { getPartnerRankings } from '@/lib/ranking-helpers'
import { Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeFilter = searchParams.get('timeFilter') || 'all'
    const gameFilter = searchParams.get('game') || undefined

    console.log('🔍 排行榜查詢參數:', { timeFilter, gameFilter })

    // 獲取排名數據
    let rankings: Array<{ partnerId: string; totalMinutes: number; rank: number }> = []
    try {
      rankings = await getPartnerRankings(timeFilter, gameFilter)
      console.log('📊 獲取到的排名數據:', rankings.length, '個夥伴')
    } catch (error: any) {
      console.error('❌ 獲取排名數據失敗:', error?.message || error)
      // 如果獲取排名失敗，繼續執行，使用空數組
      rankings = []
    }

    // 獲取夥伴詳細信息並計算平均評價
    const partners = await db.query(async (client) => {
      const partnersList = await client.partner.findMany({
        where: { 
          status: 'APPROVED',
          ...(gameFilter && {
            games: {
              hasSome: [gameFilter],
            },
          }),
        },
        select: {
          id: true,
          name: true,
          games: true,
          coverImage: true,
          isAvailableNow: true,
          isRankBooster: true,
          createdAt: true,
          userId: true, // 用於查詢評價
        },
      })

      // 優化：一次性獲取所有夥伴的評價，避免 N+1 查詢問題
      const userIds = partnersList.map(p => p.userId)
      const allReviews = await client.review.findMany({
        where: {
          revieweeId: { in: userIds },
          isApproved: true,
        },
        select: {
          revieweeId: true,
          rating: true,
        },
      })

      // 在記憶體中計算每個夥伴的平均評價
      const reviewsByUserId = new Map<string, number[]>()
      allReviews.forEach(review => {
        if (!reviewsByUserId.has(review.revieweeId)) {
          reviewsByUserId.set(review.revieweeId, [])
        }
        reviewsByUserId.get(review.revieweeId)!.push(review.rating)
      })

      // 為每個夥伴計算平均評價
      const partnersWithRatings = partnersList.map(partner => {
        const ratings = reviewsByUserId.get(partner.userId) || []
        let averageRating = 0
        if (ratings.length > 0) {
          const totalRating = ratings.reduce((sum, rating) => sum + rating, 0)
          averageRating = Math.round((totalRating / ratings.length) * 10) / 10
        }

        return {
          ...partner,
          averageRating,
          totalReviews: ratings.length,
        }
      })

      return partnersWithRatings
    }, 'partners:ranking:get')

    console.log('👥 獲取到的夥伴數量:', partners.length)

    // 合併排名數據和夥伴信息
    const rankingMap = new Map(rankings.map(r => [r.partnerId, r]))
    
    const rankingData = partners
      .map((partner) => {
        const ranking = rankingMap.get(partner.id)
        const totalMinutes = ranking?.totalMinutes || 0
        return {
          id: partner.id,
          name: partner.name,
          games: partner.games,
          totalMinutes,
          coverImage: partner.coverImage,
          isAvailableNow: partner.isAvailableNow,
          isRankBooster: partner.isRankBooster,
          rank: ranking?.rank || 999,
          createdAt: partner.createdAt.toISOString(),
          averageRating: partner.averageRating, // 平均評價
          totalReviews: partner.totalReviews, // 評價數量
        }
      })
      // 顯示所有已批准的夥伴，即使沒有時長或評價
      // 這樣可以確保排行榜不會是空的
      .sort((a, b) => {
        // 先按總時長排序
        if (b.totalMinutes !== a.totalMinutes) {
          return b.totalMinutes - a.totalMinutes
        }
        // 如果總時長相同，按平均評價排序（評價高的優先）
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating
        }
        // 如果評價也相同，按評價數量排序（評價數量多的優先）
        if (b.totalReviews !== a.totalReviews) {
          return b.totalReviews - a.totalReviews
        }
        // 如果評價數量也相同，按創建時間排序（先註冊的優先）
        const aCreatedAt = new Date(a.createdAt).getTime()
        const bCreatedAt = new Date(b.createdAt).getTime()
        return aCreatedAt - bCreatedAt
      })
      .map((partner, index) => ({
        ...partner,
        rank: index + 1, // 重新分配排名
      }))

    console.log('✅ 最終排行榜數據:', rankingData.length, '個夥伴')
    if (rankingData.length === 0) {
      console.log('⚠️ 排行榜為空，可能的原因：')
      console.log('   - 沒有已批准的夥伴')
      console.log('   - 所有夥伴都沒有時長、評價或評論')
      console.log('   - 時間篩選條件過於嚴格')
    }

    // 優化：使用 Redis 快取（排行榜不常變動）
    const cacheKey = CacheKeys.partners.ranking() + `:${timeFilter}:${gameFilter || 'all'}`;
    const cachedRanking = await Cache.getOrSet(
      cacheKey,
      async () => rankingData,
      CacheTTL.SHORT // 2 分鐘快取
    );

    // 公開資料使用 public cache
    return NextResponse.json(
      cachedRanking,
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (error) {
    return createErrorResponse(error, 'partners:ranking:get')
  }
}