import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { getPartnerRankings } from '@/lib/ranking-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeFilter = searchParams.get('timeFilter') || 'all'
    const gameFilter = searchParams.get('game') || undefined

    // 獲取排名數據
    const rankings = await getPartnerRankings(timeFilter, gameFilter)

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

    // 合併排名數據和夥伴信息
    const rankingMap = new Map(rankings.map(r => [r.partnerId, r]))
    
    const rankingData = partners
      .map((partner) => {
        const ranking = rankingMap.get(partner.id)
        return {
          id: partner.id,
          name: partner.name,
          games: partner.games,
          totalMinutes: ranking?.totalMinutes || 0,
          coverImage: partner.coverImage,
          isAvailableNow: partner.isAvailableNow,
          isRankBooster: partner.isRankBooster,
          rank: ranking?.rank || 999,
          createdAt: partner.createdAt.toISOString(),
          averageRating: partner.averageRating, // 平均評價
          totalReviews: partner.totalReviews, // 評價數量
        }
      })
      .filter(p => p.totalMinutes > 0) // 只顯示有實際時長的夥伴
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

    return NextResponse.json(rankingData)
  } catch (error) {
    return createErrorResponse(error, 'partners:ranking:get')
  }
}