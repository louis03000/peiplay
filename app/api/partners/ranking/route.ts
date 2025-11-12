import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const partners = await db.query(async (client) => {
      return client.partner.findMany({
        where: { status: 'APPROVED' },
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

    const rankingData = partners.map((partner, index) => ({
      id: partner.id,
      name: partner.name,
      games: partner.games,
      totalMinutes: Math.floor(Math.random() * 1000) + 100,
      coverImage: partner.coverImage,
      isAvailableNow: partner.isAvailableNow,
      isRankBooster: partner.isRankBooster,
      rank: index + 1,
    }))

    const sortedData = rankingData
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .map((partner, index) => ({
        ...partner,
        rank: index + 1,
      }))

    return NextResponse.json(sortedData)
  } catch (error) {
    return createErrorResponse(error, 'partners:ranking:get')
  }
}