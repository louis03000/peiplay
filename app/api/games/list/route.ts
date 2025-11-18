import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic'

/**
 * 獲取所有可用的遊戲列表
 */
export async function GET() {
  try {
    const games = await db.query(async (client) => {
      // 查詢所有已批准的夥伴，獲取他們的遊戲列表
      const partners = await client.partner.findMany({
        where: {
          status: 'APPROVED',
        },
        select: {
          games: true,
        },
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

    return NextResponse.json({ games })
  } catch (error) {
    console.error('獲取遊戲列表失敗:', error)
    return NextResponse.json({ error: '獲取遊戲列表失敗' }, { status: 500 })
  }
}

