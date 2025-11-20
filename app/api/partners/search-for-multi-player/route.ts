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
    const startDateTime = new Date(`${date}T${startTime}:00`)
    const endDateTime = new Date(`${date}T${endTime}:00`)

    // 解析遊戲列表
    const gameList = games 
      ? games.split(',').map(g => g.trim()).filter(g => g.length > 0)
      : []

    console.log('🔍 搜索參數:', { date, startTime, endTime, games: gameList })
    console.log('🔍 時間範圍:', { 
      startDateTime: startDateTime.toISOString(), 
      endDateTime: endDateTime.toISOString() 
    })

    const result = await db.query(async (client) => {
      // 查詢在指定日期和時段內有可用時段的夥伴
      // 修改：時段需要完全匹配開始和結束時間
      const partners = await client.partner.findMany({
        where: {
          status: 'APPROVED',
          schedules: {
            some: {
              date: {
                gte: new Date(date),
                lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000), // 同一天
              },
              startTime: startDateTime, // 時段開始時間必須完全匹配
              endTime: endDateTime, // 時段結束時間必須完全匹配
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
                gte: new Date(date),
                lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
              },
              startTime: startDateTime, // 完全匹配開始時間
              endTime: endDateTime, // 完全匹配結束時間
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
            // 檢查時段是否完全匹配
            const scheduleStart = new Date(schedule.startTime)
            const scheduleEnd = new Date(schedule.endTime)
            
            // 檢查是否有活躍的預約
            // 注意：Schedule.bookings 是單個對象（Booking?），不是數組
            const hasActiveBooking = schedule.bookings && 
              schedule.bookings.status !== 'CANCELLED' && 
              schedule.bookings.status !== 'REJECTED'
            
            return scheduleStart.getTime() === startDateTime.getTime() &&
                   scheduleEnd.getTime() === endDateTime.getTime() &&
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
        .filter(partner => partner!.schedules.length > 0)

      console.log('✅ 找到符合條件的夥伴:', partnersWithAvailableSchedules.length)
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

