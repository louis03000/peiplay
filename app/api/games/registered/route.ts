import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { isGameInLibrary, getGameStandardName } from '@/lib/game-library'

export const dynamic = 'force-dynamic'

/**
 * 獲取所有已登記且符合遊戲庫的遊戲列表
 * 只返回在遊戲庫中存在的遊戲
 */
export async function GET() {
  try {
    const result = await db.query(async (client) => {
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

      // 過濾：只保留在遊戲庫中的遊戲
      const registeredGames = Array.from(gamesSet)
        .filter(game => isGameInLibrary(game))
        .map(game => {
          // 獲取標準名稱（用於顯示）
          const standardName = getGameStandardName(game)
          if (standardName) {
            return {
              original: game, // 原始登記的名稱
              english: standardName.english,
              chinese: standardName.chinese,
              display: `${standardName.english} — ${standardName.chinese}` // 顯示格式
            }
          }
          return null
        })
        .filter((game): game is NonNullable<typeof game> => game !== null)

      // 去重（可能有多個變體指向同一個遊戲）
      const uniqueGames = new Map<string, typeof registeredGames[0]>()
      registeredGames.forEach(game => {
        const key = `${game.english}|${game.chinese}`
        if (!uniqueGames.has(key)) {
          uniqueGames.set(key, game)
        }
      })

      // 按英文名稱排序
      return Array.from(uniqueGames.values()).sort((a, b) => 
        a.english.localeCompare(b.english)
      )
    }, 'games:registered')

    return NextResponse.json({ games: result })
  } catch (error) {
    console.error('獲取已登記遊戲列表失敗:', error)
    return NextResponse.json({ error: '獲取已登記遊戲列表失敗' }, { status: 500 })
  }
}

