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

    // 獲取夥伴詳細信息
    const partners = await db.query(async (client) => {
      return client.partner.findMany({
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
        },
      })
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
        }
      })
      .filter(p => p.totalMinutes > 0) // 只顯示有實際時長的夥伴
      .sort((a, b) => {
        // 先按總時長排序
        if (b.totalMinutes !== a.totalMinutes) {
          return b.totalMinutes - a.totalMinutes
        }
        // 如果總時長相同，按排名排序
        return a.rank - b.rank
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