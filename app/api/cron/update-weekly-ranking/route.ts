import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { getLastWeekStartDate } from '@/lib/ranking-helpers'

export const dynamic = 'force-dynamic'

/**
 * 更新每週排名
 * 計算上一週的排名並保存到RankingHistory表
 * 可以通過cron job調用，建議每週一凌晨執行
 */
export async function GET(request: NextRequest) {
  // 驗證cron secret（如果設置了）
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const lastWeekStart = getLastWeekStartDate()
    const lastWeekEnd = new Date(lastWeekStart)
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 7)

    console.log(`🔄 開始更新每週排名，上一週: ${lastWeekStart.toISOString()} 到 ${lastWeekEnd.toISOString()}`)

    const result = await db.query(async (client) => {
      // 檢查是否已經更新過這一週的排名
      const existingRanking = await client.rankingHistory.findFirst({
        where: {
          weekStartDate: lastWeekStart,
        },
      })

      if (existingRanking) {
        console.log(`⚠️ 上一週的排名已經存在，跳過更新`)
        return {
          message: '上一週的排名已經存在',
          weekStartDate: lastWeekStart.toISOString(),
          skipped: true,
        }
      }

      // 計算上一週的排名
      // 獲取所有已批准的夥伴
      const partners = await client.partner.findMany({
        where: {
          status: 'APPROVED',
        },
        select: {
          id: true,
        },
      })

      // 計算每個夥伴上一週的總時長
      const rankings = await Promise.all(
        partners.map(async (partner) => {
          // 查詢上一週的預約
          const bookings = await client.booking.findMany({
            where: {
              schedule: {
                partnerId: partner.id,
                date: {
                  gte: lastWeekStart,
                  lt: lastWeekEnd,
                },
              },
              status: {
                in: ['COMPLETED', 'CONFIRMED'],
              },
            },
            include: {
              schedule: true,
            },
          })

          // 計算總時長（分鐘）
          let totalMinutes = 0
          for (const booking of bookings) {
            const startTime = new Date(booking.schedule.startTime)
            const endTime = new Date(booking.schedule.endTime)
            const durationMs = endTime.getTime() - startTime.getTime()
            const durationMinutes = Math.floor(durationMs / (1000 * 60))
            totalMinutes += durationMinutes
          }

          return {
            partnerId: partner.id,
            totalMinutes,
          }
        })
      )

      // 按總時長排序
      rankings.sort((a, b) => b.totalMinutes - a.totalMinutes)

      // 添加排名，只保留有實際時長的
      const rankedData = rankings
        .map((ranking, index) => ({
          ...ranking,
          rank: index + 1,
        }))
        .filter((r) => r.totalMinutes > 0)

      if (rankedData.length === 0) {
        console.log(`⚠️ 上一週沒有排名數據`)
        return {
          message: '上一週沒有排名數據',
          weekStartDate: lastWeekStart.toISOString(),
          rankingsCount: 0,
        }
      }

      // 只保存前10名的排名（有獎勵的）
      const topRankings = rankedData.slice(0, 10)

      // 批量保存到RankingHistory表
      const createPromises = topRankings.map((ranking) =>
        client.rankingHistory.upsert({
          where: {
            weekStartDate_partnerId: {
              weekStartDate: lastWeekStart,
              partnerId: ranking.partnerId,
            },
          },
          create: {
            weekStartDate: lastWeekStart,
            partnerId: ranking.partnerId,
            rank: ranking.rank,
            totalMinutes: ranking.totalMinutes,
          },
          update: {
            rank: ranking.rank,
            totalMinutes: ranking.totalMinutes,
          },
        })
      )

      await Promise.all(createPromises)

      console.log(`✅ 成功更新 ${topRankings.length} 個夥伴的排名`)

      return {
        message: `成功更新 ${topRankings.length} 個夥伴的排名`,
        weekStartDate: lastWeekStart.toISOString(),
        rankingsCount: topRankings.length,
        rankings: topRankings.map((r) => ({
          partnerId: r.partnerId,
          rank: r.rank,
          totalMinutes: r.totalMinutes,
        })),
      }
    }, 'cron/update-weekly-ranking')

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ 更新每週排名時發生錯誤:', error)
    return createErrorResponse(error, 'cron/update-weekly-ranking')
  }
}

