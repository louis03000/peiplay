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
      // 先獲取所有已批准的夥伴（不在資料庫層面篩選遊戲，因為遊戲名稱格式可能不一致）
      let partnersList = await client.partner.findMany({
        where: { 
          status: 'APPROVED',
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

      // 如果有遊戲篩選，在應用層面進行大小寫不敏感的匹配
      if (gameFilter) {
        // 🔥 遊戲名稱映射表：將中文遊戲名稱映射到可能的英文縮寫和變體
        const gameNameMap: { [key: string]: string[] } = {
          '英雄聯盟': ['lol', 'leagueoflegends', 'league of legends', 'leagueoflegends', '英雄聯盟', 'lol '],
          '特戰英豪': ['valorant', 'val', '特戰英豪'],
          'apex英雄': ['apex', 'apex legends', 'apex英雄', 'apex 英雄'],
          'apex 英雄': ['apex', 'apex legends', 'apex英雄', 'apex 英雄'],
          'csgo': ['csgo', 'cs:go', 'counter-strike', 'cs go', 'csgo '],
          'cs:go': ['csgo', 'cs:go', 'counter-strike', 'cs go'],
          'pubg': ['pubg', 'playerunknown', 'playerunknown\'s battlegrounds'],
        }
        
        // 獲取遊戲的所有可能名稱變體
        const gameFilterLower = gameFilter.toLowerCase().replace(/[:：]/g, '').trim()
        // 先嘗試直接匹配，如果沒有則使用原始值
        let possibleNames = gameNameMap[gameFilter] || gameNameMap[gameFilterLower] || [gameFilterLower]
        
        // 如果原始值（包含空格）也有映射，合併兩個映射
        if (gameNameMap[gameFilter] && gameNameMap[gameFilterLower] && gameFilter !== gameFilterLower) {
          possibleNames = [...new Set([...gameNameMap[gameFilter], ...gameNameMap[gameFilterLower]])]
        }
        
        console.log(`🎮 遊戲篩選 "${gameFilter}" (標準化: "${gameFilterLower}") 的可能名稱變體:`, possibleNames)
        
        partnersList = partnersList.filter(partner => {
          if (!partner.games || partner.games.length === 0) return false
          
          const matches = partner.games.some(game => {
            // 將遊戲名稱標準化：轉小寫並移除冒號、空格和特殊字符
            const normalizedGame = game.toLowerCase().replace(/[:：\s\-_]/g, '').trim()
            
            // 檢查是否匹配任何可能的名稱變體
            return possibleNames.some(possibleName => {
              const normalizedPossible = possibleName.toLowerCase().replace(/[:：\s\-_]/g, '').trim()
              // 使用 includes 進行部分匹配，支援 "csgo" 匹配 "CS:GO" 等情況
              // 或者完全匹配
              const match = normalizedGame.includes(normalizedPossible) || 
                           normalizedPossible.includes(normalizedGame) ||
                           normalizedGame === normalizedPossible
              
              if (match) {
                console.log(`✅ 匹配成功: 夥伴遊戲 "${game}" (標準化: "${normalizedGame}") 匹配篩選 "${gameFilter}" (變體: "${possibleName}")`)
              }
              
              return match
            })
          })
          
          if (!matches) {
            console.log(`❌ 不匹配: 夥伴 ${partner.name} 的遊戲 [${partner.games.join(', ')}] 不匹配篩選 "${gameFilter}"`)
          }
          
          return matches
        })
        console.log(`🎮 遊戲篩選 "${gameFilter}" 後，剩餘 ${partnersList.length} 個夥伴`)
      }

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