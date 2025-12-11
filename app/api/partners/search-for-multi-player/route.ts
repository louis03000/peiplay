import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const games = searchParams.get('games')

    // 驗證必要參數
    if (!date || !startTime || !endTime) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 統一日期格式
    const normalizedDate = date.replace(/\//g, '-')
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (!datePattern.test(normalizedDate)) {
      return NextResponse.json({ error: '日期格式錯誤' }, { status: 400 })
    }

    // 驗證時間格式
    const timePattern = /^\d{2}:\d{2}$/
    if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
      return NextResponse.json({ error: '時間格式錯誤' }, { status: 400 })
    }

    // 檢查時段是否在「現在+2小時」之後
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const selectedStartTime = new Date(`${normalizedDate}T${startTime}:00`)
    
    if (isNaN(selectedStartTime.getTime())) {
      return NextResponse.json({ error: '開始時間格式錯誤' }, { status: 400 })
    }
    
    if (selectedStartTime <= twoHoursLater) {
      return NextResponse.json({ 
        error: '預約時段必須在現在時間的2小時之後'
      }, { status: 400 })
    }

    // 創建時間對象（使用 UTC 以確保時區一致）
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const [year, month, day] = normalizedDate.split('-').map(Number)
    
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute) ||
        isNaN(year) || isNaN(month) || isNaN(day)) {
      return NextResponse.json({ error: '時間或日期解析失敗' }, { status: 400 })
    }
    
    // 使用 UTC 時間創建，確保與數據庫時區一致
    const startDateTime = new Date(Date.UTC(year, month - 1, day, startHour, startMinute, 0, 0))
    const endDateTime = new Date(Date.UTC(year, month - 1, day, endHour, endMinute, 0, 0))
    
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return NextResponse.json({ error: '時間對象創建失敗' }, { status: 400 })
    }
    
    if (endDateTime <= startDateTime) {
      return NextResponse.json({ error: '結束時間必須晚於開始時間' }, { status: 400 })
    }

    // 解析遊戲列表
    const gameList = games 
      ? games.split(',').map(g => g.trim().toLowerCase()).filter(g => g.length > 0)
      : []

    const result = await db.query(async (client) => {
      // 查詢日期範圍（擴大範圍以確保不遺漏）
      const dateStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      const dateEndUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
      const expandedDateStart = new Date(dateStartUTC.getTime() - 24 * 60 * 60 * 1000)
      const expandedDateEnd = new Date(dateEndUTC.getTime() + 24 * 60 * 60 * 1000)

      // 查詢已批准且開啟群組預約的夥伴
      const partners = await client.partner.findMany({
        where: {
          status: 'APPROVED',
          allowGroupBooking: true, // 只查詢開啟群組預約的夥伴
          schedules: {
            some: {
              date: {
                gte: expandedDateStart,
                lte: expandedDateEnd,
              },
              isAvailable: true
            }
          },
        },
        select: {
          id: true,
          name: true,
          games: true,
          halfHourlyRate: true,
          coverImage: true,
          user: {
            select: {
              email: true,
              isSuspended: true,
              suspensionEndsAt: true,
            }
          },
          schedules: {
            where: {
              date: {
                gte: expandedDateStart,
                lte: expandedDateEnd,
              },
              isAvailable: true
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
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            take: 100,
          }
        },
        take: 100,
      })

      // 過濾被停權的夥伴
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

      // 找到符合條件的夥伴
      const partnersWithAvailableSchedules = availablePartners
        .map(partner => {
          // 遊戲篩選
          if (gameList.length > 0) {
            const partnerGames = (partner.games || []).map((g: string) => g.toLowerCase())
            const hasMatchingGame = gameList.some(searchGame => 
              partnerGames.some(partnerGame => partnerGame === searchGame)
            )
            if (!hasMatchingGame) {
              return null
            }
          }
          
          // 找到符合時段的 schedule
          const matchingSchedule = partner.schedules.find(schedule => {
            const scheduleStart = new Date(schedule.startTime)
            const scheduleEnd = new Date(schedule.endTime)
            const scheduleDate = new Date(schedule.date)
            
            // 檢查日期是否匹配（使用 UTC 日期比較，更寬鬆的匹配）
            const scheduleDateUTC = `${scheduleDate.getUTCFullYear()}-${String(scheduleDate.getUTCMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getUTCDate()).padStart(2, '0')}`
            const searchDateUTC = `${startDateTime.getUTCFullYear()}-${String(startDateTime.getUTCMonth() + 1).padStart(2, '0')}-${String(startDateTime.getUTCDate()).padStart(2, '0')}`
            const isDateMatch = scheduleDateUTC === searchDateUTC
            
            if (!isDateMatch) return false
            
            // 檢查時間：搜尋的時段必須完全包含在夥伴的時段內
            // 使用 getTime() 進行時間戳比較，確保時區一致
            const scheduleStartTime = scheduleStart.getTime()
            const scheduleEndTime = scheduleEnd.getTime()
            const searchStartTime = startDateTime.getTime()
            const searchEndTime = endDateTime.getTime()
            
            // 夥伴的時段開始時間 <= 搜尋開始時間 且 夥伴的時段結束時間 >= 搜尋結束時間
            const isTimeContained = scheduleStartTime <= searchStartTime && 
                                   scheduleEndTime >= searchEndTime
            
            // 檢查是否有活躍的預約（bookings 是一對一關係，可能是 null 或單個對象）
            // 只排除真正活躍的預約狀態
            const hasActiveBooking = schedule.bookings && 
              schedule.bookings.status !== 'CANCELLED' && 
              schedule.bookings.status !== 'REJECTED' &&
              schedule.bookings.status !== 'COMPLETED'
            
            // 確保所有條件都滿足
            const isAvailable = schedule.isAvailable && !hasActiveBooking
            
            return isDateMatch && isTimeContained && isAvailable
          })
          
          if (!matchingSchedule) return null
          
          return {
            id: partner.id,
            name: partner.name,
            coverImage: partner.coverImage,
            games: partner.games || [],
            halfHourlyRate: partner.halfHourlyRate,
            averageRating: 0,
            totalReviews: 0,
            matchingSchedule: {
              id: matchingSchedule.id,
              startTime: matchingSchedule.startTime,
              endTime: matchingSchedule.endTime,
            }
          }
        })
        .filter(partner => partner !== null)
        .filter(partner => partner!.matchingSchedule !== null && partner!.matchingSchedule !== undefined)

      return partnersWithAvailableSchedules
    }, 'partners/search-for-multi-player')

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('搜索失敗:', error)
    return NextResponse.json(
      { 
        error: '搜尋夥伴失敗',
        message: error?.message || '未知錯誤'
      },
      { status: 500 }
    )
  }
}

