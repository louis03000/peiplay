import { db } from './db-resilience'

/**
 * 獲取週的開始日期（週一）
 */
export function getWeekStartDate(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0) // 先設置為當天的00:00:00
  const day = d.getDay() // 0 = 週日, 1 = 週一, ..., 6 = 週六
  const diff = day === 0 ? -6 : 1 - day // 如果是週日，則減6天，否則減(day-1)天
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday
}

/**
 * 獲取上一週的開始日期（週一）
 */
export function getLastWeekStartDate(): Date {
  const thisWeekStart = getWeekStartDate()
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  return lastWeekStart
}

/**
 * 獲取時間篩選的起始日期
 */
function getTimeFilterStartDate(timeFilter: string): Date | null {
  const now = new Date()
  
  switch (timeFilter) {
    case 'week':
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return weekAgo
    case 'month':
      const monthAgo = new Date(now)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return monthAgo
    case 'all':
    default:
      return null
  }
}

/**
 * 計算夥伴的總時長（分鐘）
 */
export async function calculatePartnerTotalMinutes(
  partnerId: string,
  timeFilter: string = 'all',
  gameFilter?: string
): Promise<number> {
  const startDate = getTimeFilterStartDate(timeFilter)
  
  const result = await db.query(async (client) => {
    // 構建查詢條件
    const where: any = {
      schedule: {
        partnerId,
      },
      status: {
        in: ['COMPLETED', 'CONFIRMED'],
      },
    }

    // 添加時間篩選
    if (startDate) {
      where.schedule = {
        ...where.schedule,
        date: {
          gte: startDate,
        },
      }
    }

    // 獲取所有符合條件的預約
    const bookings = await client.booking.findMany({
      where,
      include: {
        schedule: {
          include: {
            partner: {
              select: {
                games: true,
              },
            },
          },
        },
      },
    })

    console.log(`📊 計算夥伴 ${partnerId} 的總時長:`, {
      timeFilter,
      gameFilter,
      startDate: startDate?.toISOString(),
      bookingsCount: bookings.length,
    })

    // 如果指定了遊戲篩選，需要過濾
    let filteredBookings = bookings
    if (gameFilter) {
      // 🔥 使用與 API 相同的遊戲名稱映射表
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
      let possibleNames = gameNameMap[gameFilter] || gameNameMap[gameFilterLower] || [gameFilterLower]
      
      // 如果原始值（包含空格）也有映射，合併兩個映射
      if (gameNameMap[gameFilter] && gameNameMap[gameFilterLower] && gameFilter !== gameFilterLower) {
        possibleNames = [...new Set([...gameNameMap[gameFilter], ...gameNameMap[gameFilterLower]])]
      }
      
      console.log(`🎮 遊戲篩選 "${gameFilter}" 的可能名稱變體:`, possibleNames)
      
      filteredBookings = bookings.filter((booking) => {
        const partnerGames = booking.schedule.partner.games || []
        
        // 調試日誌
        if (bookings.length > 0 && bookings.indexOf(booking) === 0) {
          console.log(`🔍 夥伴 ${partnerId} 的遊戲列表:`, partnerGames)
        }
        
        const matches = partnerGames.some((game) => {
          // 將遊戲名稱標準化：轉小寫並移除冒號、空格和特殊字符
          const normalizedGame = game.toLowerCase().replace(/[:：\s\-_]/g, '').trim()
          
          // 檢查是否匹配任何可能的名稱變體
          const match = possibleNames.some(possibleName => {
            const normalizedPossible = possibleName.toLowerCase().replace(/[:：\s\-_]/g, '').trim()
            // 使用 includes 進行部分匹配，支援 "csgo" 匹配 "CS:GO" 等情況
            // 或者完全匹配
            const isMatch = normalizedGame.includes(normalizedPossible) || 
                           normalizedPossible.includes(normalizedGame) ||
                           normalizedGame === normalizedPossible
            
            if (isMatch && bookings.length > 0 && bookings.indexOf(booking) === 0) {
              console.log(`✅ 匹配成功: 夥伴遊戲 "${game}" (標準化: "${normalizedGame}") 匹配篩選 "${gameFilter}" (變體: "${possibleName}")`)
            }
            
            return isMatch
          })
          
          return match
        })
        
        if (!matches && bookings.length > 0 && bookings.indexOf(booking) === 0) {
          console.log(`❌ 不匹配: 夥伴 ${partnerId} 的遊戲 [${partnerGames.join(', ')}] 不匹配篩選 "${gameFilter}"`)
        }
        
        return matches
      })
      
      console.log(`🎮 遊戲篩選 "${gameFilter}" 後，剩餘 ${filteredBookings.length} 個預約（原本 ${bookings.length} 個）`)
    }

    // 計算總時長（分鐘）
    let totalMinutes = 0
    for (const booking of filteredBookings) {
      const startTime = new Date(booking.schedule.startTime)
      const endTime = new Date(booking.schedule.endTime)
      const durationMs = endTime.getTime() - startTime.getTime()
      const durationMinutes = Math.floor(durationMs / (1000 * 60))
      totalMinutes += durationMinutes
    }

    if (totalMinutes > 0) {
      console.log(`✅ 夥伴 ${partnerId} 總時長: ${totalMinutes} 分鐘 (${Math.round(totalMinutes / 60 * 10) / 10} 小時)`)
    }

    return totalMinutes
  }, 'ranking:calculate-total-minutes')

  return result
}

/**
 * 獲取所有夥伴的排名數據
 */
export async function getPartnerRankings(
  timeFilter: string = 'all',
  gameFilter?: string
): Promise<Array<{ partnerId: string; totalMinutes: number; rank: number }>> {
  const result = await db.query(async (client) => {
    // 獲取所有已批准的夥伴
    let partners = await client.partner.findMany({
      where: {
        status: 'APPROVED',
      },
      select: {
        id: true,
        games: true, // 🔥 需要獲取 games 來進行篩選
      },
    })

    // 🔥 如果有遊戲篩選，先篩選有該遊戲的夥伴
    if (gameFilter) {
      // 使用與 API 相同的遊戲名稱映射表
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
      let possibleNames = gameNameMap[gameFilter] || gameNameMap[gameFilterLower] || [gameFilterLower]
      
      // 如果原始值（包含空格）也有映射，合併兩個映射
      if (gameNameMap[gameFilter] && gameNameMap[gameFilterLower] && gameFilter !== gameFilterLower) {
        possibleNames = [...new Set([...gameNameMap[gameFilter], ...gameNameMap[gameFilterLower]])]
      }
      
      partners = partners.filter(partner => {
        if (!partner.games || partner.games.length === 0) return false
        
        return partner.games.some(game => {
          // 將遊戲名稱標準化：轉小寫並移除冒號、空格和特殊字符
          const normalizedGame = game.toLowerCase().replace(/[:：\s\-_]/g, '').trim()
          
          // 檢查是否匹配任何可能的名稱變體
          return possibleNames.some(possibleName => {
            const normalizedPossible = possibleName.toLowerCase().replace(/[:：\s\-_]/g, '').trim()
            // 使用 includes 進行部分匹配，支援 "csgo" 匹配 "CS:GO" 等情況
            // 或者完全匹配
            return normalizedGame.includes(normalizedPossible) || 
                   normalizedPossible.includes(normalizedGame) ||
                   normalizedGame === normalizedPossible
          })
        })
      })
      
      console.log(`🎮 getPartnerRankings: 遊戲篩選 "${gameFilter}" 後，剩餘 ${partners.length} 個夥伴`)
    }

    // 計算每個夥伴的總時長
    const rankings = await Promise.all(
      partners.map(async (partner) => {
        const totalMinutes = await calculatePartnerTotalMinutes(
          partner.id,
          timeFilter,
          gameFilter
        )
        return {
          partnerId: partner.id,
          totalMinutes,
        }
      })
    )

    // 按總時長排序
    rankings.sort((a, b) => b.totalMinutes - a.totalMinutes)

    // 添加排名
    return rankings.map((ranking, index) => ({
      ...ranking,
      rank: index + 1,
    }))
  }, 'ranking:get-rankings')

  return result
}

/**
 * 獲取特定夥伴的排名（當前週）
 */
export async function getPartnerRank(partnerId: string): Promise<number | null> {
  const rankings = await getPartnerRankings('all')
  const partnerRanking = rankings.find((r) => r.partnerId === partnerId)
  return partnerRanking ? partnerRanking.rank : null
}

/**
 * 獲取特定夥伴上一週的排名（用於計算平台維護費）
 * 本週的排名決定下週的減免，所以計算當前週的費用時，需要查詢上一週的排名
 */
export async function getPartnerLastWeekRank(partnerId: string): Promise<number | null> {
  try {
    const lastWeekStart = getLastWeekStartDate()
    
    const result = await db.query(async (client) => {
      // 檢查 RankingHistory 表是否存在
      try {
        const rankingHistory = await client.rankingHistory.findUnique({
          where: {
            weekStartDate_partnerId: {
              weekStartDate: lastWeekStart,
              partnerId,
            },
          },
          select: {
            rank: true,
          },
        })

        return rankingHistory?.rank || null
      } catch (error: any) {
        // 如果表不存在或其他錯誤，返回 null（使用默認費率）
        // 只在開發環境輸出警告，避免生產環境日誌污染
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ RankingHistory 表查詢失敗，使用默認費率:', error?.message || error)
        }
        return null
      }
    }, 'ranking:get-last-week-rank')

    return result
  } catch (error: any) {
    // 如果查詢失敗，返回 null（使用默認費率）
    // 只在開發環境輸出警告，避免生產環境日誌污染
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ 獲取上一週排名失敗，使用默認費率:', error?.message || error)
    }
    return null
  }
}

/**
 * 根據排名獲取平台維護費折扣
 * 第一名：-2%，第二三名：-1%，其他：0%
 */
export function getPlatformFeeDiscount(rank: number | null): number {
  if (!rank) return 0
  
  if (rank === 1) {
    return 0.02 // 2%
  } else if (rank === 2 || rank === 3) {
    return 0.01 // 1%
  }
  
  return 0
}

/**
 * 根據排名計算實際平台維護費百分比
 * 基礎費率15%，第一名：13%，第二三名：14%，其他：15%
 * 注意：這裡傳入的rank應該是上一週的排名
 */
export function calculatePlatformFeePercentage(rank: number | null): number {
  const baseFee = 0.15 // 15%
  const discount = getPlatformFeeDiscount(rank)
  return baseFee - discount
}

/**
 * 獲取夥伴當前應該使用的平台維護費百分比
 * 基於上一週的排名來計算
 */
export async function getPartnerPlatformFeePercentage(partnerId: string): Promise<number> {
  const lastWeekRank = await getPartnerLastWeekRank(partnerId)
  return calculatePlatformFeePercentage(lastWeekRank)
}

