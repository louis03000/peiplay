import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { taipeiToUTC } from '@/lib/time-utils'
import { BookingStatus } from '@prisma/client'

// 定義終止狀態：這些狀態的預約不會佔用時段
const TERMINAL_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
  BookingStatus.REJECTED,
  BookingStatus.PARTNER_REJECTED,
  BookingStatus.COMPLETED_WITH_AMOUNT_MISMATCH,
]

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const startTime = searchParams.get('startTime') // 格式: "10:00"
    const endTime = searchParams.get('endTime') // 格式: "12:00"
    const game = searchParams.get('game')

    if (!startDate || !endDate || !startTime || !endTime) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 轉換時間格式為 Date 對象（使用台灣時區）
    const startDateTime = taipeiToUTC(startDate, startTime)
    const endDateTime = taipeiToUTC(endDate, endTime)

    const result = await db.query(async (client) => {
      // 優化：使用 select 而非 include，只查詢必要欄位
      // 優化：添加 take 限制，避免載入過多資料
      // 優化：移除 reviewsReceived，改用批量聚合查詢
      
      // 查詢在指定日期範圍和時段範圍內有可用時段的夥伴
      const partners = await client.partner.findMany({
        where: {
          status: 'APPROVED',
          schedules: {
            some: {
              date: {
                gte: taipeiToUTC(startDate, '00:00'),
                lte: taipeiToUTC(endDate, '23:59'),
              },
              startTime: {
                lte: startDateTime, // 時段開始時間不晚於搜尋開始時間
              },
              endTime: {
                gte: endDateTime, // 時段結束時間不早於搜尋結束時間
              },
              isAvailable: true
            }
          },
          // 遊戲篩選
          ...(game && game.trim() ? {
            games: {
              hasSome: [game.trim()]
            }
          } : {})
        },
        select: {
          id: true,
          name: true,
          games: true,
          halfHourlyRate: true,
          coverImage: true,
          images: true,
          rankBoosterImages: true,
          isAvailableNow: true,
          isRankBooster: true,
          allowGroupBooking: true,
          rankBoosterNote: true,
          rankBoosterRank: true,
          customerMessage: true,
          supportsChatOnly: true,
          chatOnlyRate: true,
          userId: true, // 用於後續查詢平均評分
          user: {
            select: {
              email: true,
              discord: true,
              isSuspended: true,
              suspensionEndsAt: true,
              // 移除 reviewsReceived，改用批量查詢
            }
          },
          schedules: {
            where: {
              date: {
                gte: taipeiToUTC(startDate, '00:00'),
                lte: taipeiToUTC(endDate, '23:59'),
              },
              startTime: {
                lte: startDateTime,
              },
              endTime: {
                gte: endDateTime,
              },
              isAvailable: true,
            },
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              isAvailable: true,
              bookings: {
                select: {
                  id: true,
                  status: true,
                }
              }
            },
            take: 50, // 限制每個 partner 最多載入 50 個時段
          }
        },
        take: 100, // 限制結果數量，提升速度
        orderBy: { createdAt: 'desc' },
      })

      // 優化：批量查詢平均評分（避免 N+1 query）
      const userIds = partners.map(p => p.userId).filter(Boolean) as string[]
      let avgRatingsMap = new Map<string, { averageRating: number; totalReviews: number }>()
      
      if (userIds.length > 0) {
        // 使用聚合查詢獲取平均評分
        const reviews = await client.review.groupBy({
          by: ['revieweeId'],
          where: {
            revieweeId: { in: userIds },
            isApproved: true, // 只計算已批准的評價
          },
          _avg: {
            rating: true,
          },
          _count: {
            id: true,
          },
        })
        
        // 建立 userId -> 平均評分的映射
        avgRatingsMap = new Map(
          reviews.map(r => [
            r.revieweeId,
            {
              averageRating: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : 0,
              totalReviews: r._count.id,
            }
          ])
        )
      }

    // 過濾掉被停權的夥伴
    const availablePartners = partners.filter(partner => {
      if (!partner.user) return true
      
      const user = partner.user as any
      if (user.isSuspended) {
        const now = new Date()
        const endsAt = user.suspensionEndsAt ? new Date(user.suspensionEndsAt) : null
        
        if (endsAt && endsAt > now) {
          return false
        }
      }
      
      return true
    })

      // 只返回有可用時段的夥伴，並為每個時段添加搜尋時段限制，同時使用批量查詢的平均星等
      const terminalStatusSet = new Set(TERMINAL_BOOKING_STATUSES);
      const partnersWithAvailableSchedules = availablePartners
        .map(partner => {
          // 從批量查詢結果獲取平均評分
          const userId = partner.userId
          const ratingData = userId ? avgRatingsMap.get(userId) : null
          const averageRating = ratingData?.averageRating || 0
          const totalReviews = ratingData?.totalReviews || 0
          
          return {
            ...partner,
            averageRating,
            totalReviews,
            schedules: partner.schedules
              .filter(schedule => {
                // 過濾：只保留沒有預約或預約狀態是終止狀態的時段
                if (!schedule.bookings) {
                  return true; // 沒有預約，可以選擇
                }
                // 有預約，檢查狀態是否為終止狀態
                return terminalStatusSet.has(schedule.bookings.status);
              })
              .map(schedule => ({
                ...schedule,
                // 添加搜尋時段限制信息
                searchTimeRestriction: {
                  startTime,
                  endTime,
                  startDate,
                  endDate
                }
              }))
          };
        })
        .filter(partner => partner.schedules.length > 0)

      return partnersWithAvailableSchedules
    }, 'partners/search-by-time')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error searching partners by time:', error)
    return NextResponse.json(
      { error: '搜尋夥伴失敗' },
      { status: 500 }
    )
  }
}
