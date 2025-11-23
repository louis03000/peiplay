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
    // 使用本地時區創建日期時間對象（避免時區轉換問題）
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const [year, month, day] = dateStr.split('-').map(Number)
    
    const startDateTime = new Date(year, month - 1, day, startHour, startMinute, 0, 0)
    const endDateTime = new Date(year, month - 1, day, endHour, endMinute, 0, 0)

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
      // 先使用寬鬆的查詢條件，然後在 JavaScript 中進行精確匹配
      const partners = await client.partner.findMany({
        where: {
          status: 'APPROVED',
          schedules: {
            some: {
              date: {
                gte: dateStart,
                lte: dateEnd,
              },
              // 使用範圍查詢，找到可能符合的時段
              startTime: {
                lte: endDateTime, // 時段開始時間不晚於搜尋結束時間（包含在範圍內）
              },
              endTime: {
                gte: startDateTime, // 時段結束時間不早於搜尋開始時間（包含在範圍內）
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
              // 使用更寬鬆的範圍查詢
              startTime: {
                lte: endDateTime,
              },
              endTime: {
                gte: startDateTime,
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
          // 需要完全匹配開始和結束時間
          const matchingSchedule = partner.schedules.find(schedule => {
            const scheduleStart = new Date(schedule.startTime)
            const scheduleEnd = new Date(schedule.endTime)
            
            // 檢查日期是否匹配（使用 schedule.date 字段）
            const scheduleDate = new Date(schedule.date)
            // 將日期轉換為 YYYY-MM-DD 格式（使用本地時區）
            const scheduleYear = scheduleDate.getFullYear()
            const scheduleMonth = String(scheduleDate.getMonth() + 1).padStart(2, '0')
            const scheduleDay = String(scheduleDate.getDate()).padStart(2, '0')
            const scheduleDateStr = `${scheduleYear}-${scheduleMonth}-${scheduleDay}`
            const searchDateStr = dateStr // 直接使用傳入的日期字符串 "YYYY-MM-DD"
            
            // 檢查時間是否完全匹配（允許最多5分鐘的誤差）
            // 比較時段的小時和分鐘（使用本地時區）
            const scheduleStartHours = scheduleStart.getHours()
            const scheduleStartMinutes = scheduleStart.getMinutes()
            const scheduleEndHours = scheduleEnd.getHours()
            const scheduleEndMinutes = scheduleEnd.getMinutes()
            
            const searchStartHours = startDateTime.getHours()
            const searchStartMinutes = startDateTime.getMinutes()
            const searchEndHours = endDateTime.getHours()
            const searchEndMinutes = endDateTime.getMinutes()
            
            // 檢查是否有活躍的預約
            // 注意：Schedule.bookings 是單個對象（Booking?），不是數組
            const hasActiveBooking = schedule.bookings && 
              schedule.bookings.status !== 'CANCELLED' && 
              schedule.bookings.status !== 'REJECTED'
            
            // 比較小時和分鐘是否匹配（允許最多5分鐘的誤差）
            const startTimeMatch = scheduleStartHours === searchStartHours && 
              Math.abs(scheduleStartMinutes - searchStartMinutes) <= 5
            const endTimeMatch = scheduleEndHours === searchEndHours && 
              Math.abs(scheduleEndMinutes - searchEndMinutes) <= 5
            const isTimeMatch = startTimeMatch && endTimeMatch
            const isDateMatch = scheduleDateStr === searchDateStr
            
            // 計算時間差（用於調試）
            const startDiffMinutes = Math.abs((scheduleStartHours * 60 + scheduleStartMinutes) - (searchStartHours * 60 + searchStartMinutes))
            const endDiffMinutes = Math.abs((scheduleEndHours * 60 + scheduleEndMinutes) - (searchEndHours * 60 + searchEndMinutes))
            
            console.log('🔍 檢查時段:', {
              partnerName: partner.name,
              scheduleId: schedule.id,
              scheduleDate: scheduleDateStr,
              searchDate: searchDateStr,
              scheduleStart: scheduleStart.toISOString(),
              scheduleEnd: scheduleEnd.toISOString(),
              searchStart: startDateTime.toISOString(),
              searchEnd: endDateTime.toISOString(),
              scheduleTime: `${scheduleStartHours}:${String(scheduleStartMinutes).padStart(2, '0')} - ${scheduleEndHours}:${String(scheduleEndMinutes).padStart(2, '0')}`,
              searchTime: `${searchStartHours}:${String(searchStartMinutes).padStart(2, '0')} - ${searchEndHours}:${String(searchEndMinutes).padStart(2, '0')}`,
              startDiffMinutes,
              endDiffMinutes,
              isDateMatch,
              isTimeMatch,
              isAvailable: schedule.isAvailable,
              hasActiveBooking,
              willMatch: isDateMatch && isTimeMatch && schedule.isAvailable && !hasActiveBooking
            })
            
            return isDateMatch &&
                   isTimeMatch &&
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

      console.log('✅ 初步查詢找到夥伴:', partners.length)
      console.log('✅ 過濾後找到符合條件的夥伴:', partnersWithAvailableSchedules.length)
      if (partnersWithAvailableSchedules.length > 0) {
        console.log('✅ 夥伴列表:', partnersWithAvailableSchedules.map(p => ({
          id: p!.id,
          name: p!.name,
          matchingSchedule: p!.matchingSchedule
        })))
      } else {
        console.log('⚠️ 沒有找到匹配的時段，檢查所有時段:')
        availablePartners.forEach(partner => {
          console.log(`  夥伴 ${partner.name} 的時段:`, partner.schedules.map(s => ({
            id: s.id,
            startTime: new Date(s.startTime).toISOString(),
            endTime: new Date(s.endTime).toISOString(),
            isAvailable: s.isAvailable,
            hasBooking: !!s.bookings
          })))
        })
      }
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

