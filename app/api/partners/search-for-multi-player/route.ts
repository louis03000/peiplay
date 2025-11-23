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
    // 解析時間
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const [year, month, day] = dateStr.split('-').map(Number)
    
    // 使用 UTC 時區創建時間對象，與數據庫保持一致
    // 假設用戶輸入的是本地時間，需要轉換為 UTC
    // 但為了簡化，我們假設用戶輸入的時間就是 UTC 時間（或服務器時區）
    const startDateTime = new Date(Date.UTC(year, month - 1, day, startHour, startMinute, 0, 0))
    const endDateTime = new Date(Date.UTC(year, month - 1, day, endHour, endMinute, 0, 0))

    // 解析遊戲列表
    const gameList = games 
      ? games.split(',').map(g => g.trim()).filter(g => g.length > 0)
      : []

    console.log('🔍 ========== 開始搜索多人陪玩夥伴 ==========')
    console.log('🔍 搜索參數:', { 
      date, 
      dateStr, 
      startTime, 
      endTime, 
      games: gameList,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString()
    })

    const result = await db.query(async (client) => {
      // 先查詢所有符合日期和時間範圍的時段，然後再過濾
      // 使用 UTC 時區創建日期範圍，確保與數據庫一致
      const dateStart = new Date(`${dateStr}T00:00:00.000Z`)
      const dateEnd = new Date(`${dateStr}T23:59:59.999Z`)

      console.log('🔍 搜索參數詳情:', {
        dateStr,
        startTime,
        endTime,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        startDateTimeLocal: `${startDateTime.getFullYear()}-${String(startDateTime.getMonth() + 1).padStart(2, '0')}-${String(startDateTime.getDate()).padStart(2, '0')} ${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`,
        endDateTimeLocal: `${endDateTime.getFullYear()}-${String(endDateTime.getMonth() + 1).padStart(2, '0')}-${String(endDateTime.getDate()).padStart(2, '0')} ${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`,
      })
      console.log('🔍 日期範圍:', {
        dateStart: dateStart.toISOString(),
        dateEnd: dateEnd.toISOString()
      })

      // 查詢在指定日期和時段內有可用時段的夥伴
      // 先查詢所有已批准的夥伴，然後在 JavaScript 中進行精確匹配
      // 這樣可以確保不會因為查詢條件太嚴格而漏掉夥伴
      const partners = await client.partner.findMany({
        where: {
          status: 'APPROVED',
          schedules: {
            some: {
              date: {
                gte: dateStart,
                lte: dateEnd,
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

      console.log('📊 數據庫查詢結果:', {
        totalPartners: partners.length,
        partnersWithSchedules: partners.filter(p => p.schedules.length > 0).length,
        totalSchedules: partners.reduce((sum, p) => sum + p.schedules.length, 0)
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
            const scheduleDate = new Date(schedule.date)
            
            // 檢查日期是否匹配 - 比較日期字符串（YYYY-MM-DD）
            // 從完整的 ISO 字符串中提取日期部分
            const scheduleDateStr = scheduleDate.toISOString().split('T')[0]
            const searchDateStr = dateStr
            const isDateMatch = scheduleDateStr === searchDateStr
            
            // 檢查時間是否完全匹配
            // 提取時間部分（HH:MM）進行比較，允許最多5分鐘的誤差
            // 使用 UTC 時間進行比較，確保一致性
            const scheduleStartHour = scheduleStart.getUTCHours()
            const scheduleStartMinute = scheduleStart.getUTCMinutes()
            const scheduleEndHour = scheduleEnd.getUTCHours()
            const scheduleEndMinute = scheduleEnd.getUTCMinutes()
            
            const searchStartHour = startDateTime.getUTCHours()
            const searchStartMinute = startDateTime.getUTCMinutes()
            const searchEndHour = endDateTime.getUTCHours()
            const searchEndMinute = endDateTime.getUTCMinutes()
            
            // 計算時間差（分鐘）
            const startDiffMinutes = Math.abs((scheduleStartHour * 60 + scheduleStartMinute) - (searchStartHour * 60 + searchStartMinute))
            const endDiffMinutes = Math.abs((scheduleEndHour * 60 + scheduleEndMinute) - (searchEndHour * 60 + searchEndMinute))
            
            // 允許最多5分鐘的誤差
            const isTimeMatch = startDiffMinutes <= 5 && endDiffMinutes <= 5
            
            // 檢查是否有活躍的預約
            // 注意：Schedule.bookings 是單個對象（Booking?），不是數組
            const hasActiveBooking = schedule.bookings && 
              schedule.bookings.status !== 'CANCELLED' && 
              schedule.bookings.status !== 'REJECTED'
            
            console.log('🔍 檢查時段:', {
              partnerName: partner.name,
              scheduleId: schedule.id,
              scheduleDateStr,
              searchDateStr,
              scheduleStartISO: scheduleStart.toISOString(),
              scheduleEndISO: scheduleEnd.toISOString(),
              searchStartISO: startDateTime.toISOString(),
              searchEndISO: endDateTime.toISOString(),
              scheduleTime: `${scheduleStartHour}:${String(scheduleStartMinute).padStart(2, '0')} - ${scheduleEndHour}:${String(scheduleEndMinute).padStart(2, '0')}`,
              searchTime: `${searchStartHour}:${String(searchStartMinute).padStart(2, '0')} - ${searchEndHour}:${String(searchEndMinute).padStart(2, '0')}`,
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
      
      if (partners.length === 0) {
        console.log('⚠️ 數據庫查詢沒有找到任何夥伴，可能的原因：')
        console.log('   - 沒有 APPROVED 狀態的夥伴')
        console.log('   - 沒有符合日期範圍的時段')
        console.log('   - 時段時間範圍不匹配')
        console.log('   - 時段 isAvailable = false')
        if (gameList.length > 0) {
          console.log('   - 遊戲篩選條件不匹配:', gameList)
        }
      } else if (partnersWithAvailableSchedules.length === 0) {
        console.log('⚠️ 找到夥伴但沒有匹配的時段，詳細檢查:')
        availablePartners.forEach(partner => {
          console.log(`  夥伴 ${partner.name} (ID: ${partner.id}):`)
          if (partner.schedules.length === 0) {
            console.log('    - 沒有符合查詢條件的時段')
          } else {
            partner.schedules.forEach(s => {
              const sStart = new Date(s.startTime)
              const sEnd = new Date(s.endTime)
              const sDate = new Date(s.date)
              console.log(`    時段 ${s.id}:`, {
                date: sDate.toISOString().split('T')[0],
                startTime: sStart.toISOString(),
                endTime: sEnd.toISOString(),
                startTimeLocal: `${sStart.getUTCHours()}:${String(sStart.getUTCMinutes()).padStart(2, '0')}`,
                endTimeLocal: `${sEnd.getUTCHours()}:${String(sEnd.getUTCMinutes()).padStart(2, '0')}`,
                isAvailable: s.isAvailable,
                hasBooking: !!s.bookings,
                bookingStatus: s.bookings?.status
              })
            })
          }
        })
      } else {
        console.log('✅ 夥伴列表:', partnersWithAvailableSchedules.map(p => ({
          id: p!.id,
          name: p!.name,
          matchingSchedule: p!.matchingSchedule
        })))
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

