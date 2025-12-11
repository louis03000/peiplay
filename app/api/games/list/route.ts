import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache'

export const dynamic = 'force-dynamic'

/**
 * 獲取所有可用的遊戲列表
 */
export async function GET() {
  try {
    // 優化：使用 Redis 快取（遊戲列表不常變動）
    const games = await Cache.getOrSet(
      CacheKeys.stats.platform() + ':games',
      async () => {
        return await db.query(async (client) => {
          // 查詢所有已批准的夥伴，獲取他們的遊戲列表
          const partners = await client.partner.findMany({
            where: {
              status: 'APPROVED',
            },
            select: {
              games: true,
            },
            take: 1000, // 限制查詢數量
          })

          // 提取所有遊戲並去重
          const gamesSet = new Set<string>()
          partners.forEach(partner => {
            if (Array.isArray(partner.games)) {
              partner.games.forEach(game => {
                if (game && game.trim().length > 0) {
                  gamesSet.add(game.trim())
                }
              })
            }
          })

          return Array.from(gamesSet).sort()
        }, 'games:list')
      },
      CacheTTL.MEDIUM // 5 分鐘快取
    )

    // 公開資料使用 public cache
    return NextResponse.json(
      { games },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('獲取遊戲列表失敗:', error)
    return NextResponse.json({ error: '獲取遊戲列表失敗' }, { status: 500 })
  }
}

