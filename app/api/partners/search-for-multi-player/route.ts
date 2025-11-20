import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // 格式: "2024-01-15"
    const startTime = searchParams.get('startTime') // 格式: "14:00"
    const endTime = searchParams.get('endTime') // 格式: "16:00"
    const games = searchParams.get('games') // 格式: "game1,game2" 或單個遊戲

    if (!date || !startTime || !endTime) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 檢查時段是否在「現在+2小時」之後
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const selectedStartTime = new Date(`${date}T${startTime}:00`)
    
    if (selectedStartTime <= twoHoursLater) {
      return NextResponse.json({ 
        error: '預約時段必須在現在時間的2小時之後',
        minTime: twoHoursLater.toISOString()
      }, { status: 400 })
    }

    // 轉換時間格式為 Date 對象
    // 確保日期格式正確（YYYY-MM-DD）
    const dateStr = date.split('T')[0] // 移除時間部分（如果有）
    const startDateTime = new Date(`${dateStr}T${startTime}:00`)
    const endDateTime = new Date(`${dateStr}T${endTime}:00`)

    // 解析遊戲列表
    const gameList = games 
      ? games.split(',').map(g => g.trim()).filter(g => g.length > 0)
      : []

    console.log('🔍 搜索參數:', { date, dateStr, startTime, endTime, games: gameList })
    console.log('🔍 時間範圍:', { 
      startDateTime: startDateTime.toISOString(), 
      endDateTime: endDateTime.toISOString(),
      startTimeStr: `${dateStr}T${startTime}:00`,
      endTimeStr: `${dateStr}T${endTime}:00`
    })

    const result = await db.query(async (client) => {
      // 先查詢所有符合日期和時間範圍的時段，然後再過濾
      const dateStart = new Date(dateStr)
      dateStart.setHours(0, 0, 0, 0)
      const dateEnd = new Date(dateStr)
      dateEnd.setHours(23, 59, 59, 999)

      console.log('🔍 日期範圍:', {
        dateStart: dateStart.toISOString(),
        dateEnd: dateEnd.toISOString()
      })

      // 查詢在指定日期和時段內有可用時段的夥伴
      // 使用範圍查詢，然後在後續過濾中進行精確匹配
      const partners = await client.partner.findMany({
        where: {
          status: 'APPROVED',
          schedules: {
            some: {
              date: {
                gte: dateStart,
                lte: dateEnd,
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
          ...(gameList.length > 0 ? {
            games: {
              hasSome: gameList
            }
          } : {})
        },
        include: {
          user: {
            select: {
              email: true,
              discord: true,
              isSuspended: true,
              suspensionEndsAt: true,
              reviewsReceived: {
                select: {
                  rating: true
                }
              }
            }
          },
          schedules: {
            where: {
              date: {
                gte: dateStart,
                lte: dateEnd,
              },
              startTime: {
                lte: startDateTime,
              },
              endTime: {
                gte: endDateTime,
              },
              isAvailable: true
            },
            include: {
              bookings: {
                select: {
                  id: true,
                  status: true,
                }
              }
            }
          }
        }
      })

      // 過濾掉被停權的夥伴
      const availablePartners = partners.filter(partner => {
        if (!partner.user) return false
        
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

      // 只返回有可用時段的夥伴，並計算平均星等
      const partnersWithAvailableSchedules = availablePartners
        .map(partner => {
          // 計算平均星等
          const reviews = partner.user?.reviewsReceived || [];
          const averageRating = reviews.length > 0 
            ? reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / reviews.length
            : 0;
          
          // 找到符合時段的 schedule
          const matchingSchedule = partner.schedules.find(schedule => {
            // 檢查時段是否完全匹配（允許1秒的誤差，因為數據庫精度問題）
            const scheduleStart = new Date(schedule.startTime)
            const scheduleEnd = new Date(schedule.endTime)
            
            const startDiff = Math.abs(scheduleStart.getTime() - startDateTime.getTime())
            const endDiff = Math.abs(scheduleEnd.getTime() - endDateTime.getTime())
            
            // 檢查是否有活躍的預約
            // 注意：Schedule.bookings 是單個對象（Booking?），不是數組
            const hasActiveBooking = schedule.bookings && 
              schedule.bookings.status !== 'CANCELLED' && 
              schedule.bookings.status !== 'REJECTED'
            
            // 允許最多1秒的誤差（處理時區或精度問題）
            const isTimeMatch = startDiff <= 1000 && endDiff <= 1000
            
            console.log('🔍 檢查時段:', {
              partnerName: partner.name,
              scheduleId: schedule.id,
              scheduleStart: scheduleStart.toISOString(),
              scheduleEnd: scheduleEnd.toISOString(),
              searchStart: startDateTime.toISOString(),
              searchEnd: endDateTime.toISOString(),
              startDiff,
              endDiff,
              isTimeMatch,
              isAvailable: schedule.isAvailable,
              hasActiveBooking
            })
            
            return isTimeMatch &&
                   schedule.isAvailable &&
                   !hasActiveBooking
          })
          
          if (!matchingSchedule) return null
          
          return {
            ...partner,
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews: reviews.length,
            matchingSchedule: {
              id: matchingSchedule.id,
              startTime: matchingSchedule.startTime,
              endTime: matchingSchedule.endTime,
            }
          };
        })
        .filter(partner => partner !== null)
        .filter(partner => partner!.matchingSchedule !== null && partner!.matchingSchedule !== undefined)

      console.log('✅ 找到符合條件的夥伴:', partnersWithAvailableSchedules.length)
      console.log('✅ 夥伴列表:', partnersWithAvailableSchedules.map(p => ({
        id: p!.id,
        name: p!.name,
        matchingSchedule: p!.matchingSchedule
      })))
      return partnersWithAvailableSchedules
    }, 'partners/search-for-multi-player')

    console.log('📤 返回結果:', result.length, '位夥伴')
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error searching partners for multi-player:', error)
    return NextResponse.json(
      { error: '搜尋夥伴失敗' },
      { status: 500 }
    )
  }
}

