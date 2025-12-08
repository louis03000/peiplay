import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const maxDuration = 30 // Vercel 最大執行時間 30 秒

export async function GET(request: Request) {
  const performanceStartTime = Date.now()
  console.log('🔵 ========== API 被調用 ==========')
  console.log('🔵 Request URL:', request.url)
  console.log('🔵 開始時間:', new Date().toISOString())
  
  try {
    const session = await getServerSession(authOptions)
    console.log('🔵 Session:', session ? '存在' : '不存在', session?.user?.id || '無用戶ID')
    
    if (!session?.user) {
      console.log('❌ 未授權')
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // 格式: "2024-01-15" 或 "2024/01/15"
    const startTime = searchParams.get('startTime') // 格式: "14:00"
    const endTime = searchParams.get('endTime') // 格式: "16:00"
    const games = searchParams.get('games') // 格式: "game1,game2" 或單個遊戲

    console.log('🔵 接收到的原始參數:', { date, startTime, endTime, games })

    // 驗證參數格式
    if (!date || !startTime || !endTime) {
      console.log('❌ 缺少必要參數:', { date: !!date, startTime: !!startTime, endTime: !!endTime })
      return NextResponse.json({ 
        error: '缺少必要參數',
        details: { date: !!date, startTime: !!startTime, endTime: !!endTime }
      }, { status: 400 })
    }

    // 統一日期格式：將 "2024/01/15" 轉換為 "2024-01-15"
    const normalizedDate = date.replace(/\//g, '-')
    
    // 驗證日期格式
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (!datePattern.test(normalizedDate)) {
      console.log('❌ 日期格式錯誤:', normalizedDate)
      return NextResponse.json({ 
        error: '日期格式錯誤，應為 YYYY-MM-DD',
        received: date
      }, { status: 400 })
    }

    // 驗證時間格式
    const timePattern = /^\d{2}:\d{2}$/
    if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
      console.log('❌ 時間格式錯誤:', { startTime, endTime })
      return NextResponse.json({ 
        error: '時間格式錯誤，應為 HH:MM',
        received: { startTime, endTime }
      }, { status: 400 })
    }

    console.log('🔵 標準化後的參數:', { date: normalizedDate, startTime, endTime, games })

    // 檢查時段是否在「現在+2小時」之後
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const selectedStartTime = new Date(`${normalizedDate}T${startTime}:00`)
    
    if (isNaN(selectedStartTime.getTime())) {
      console.log('❌ 無法解析開始時間:', `${normalizedDate}T${startTime}:00`)
      return NextResponse.json({ 
        error: '開始時間格式錯誤',
        received: { date: normalizedDate, startTime }
      }, { status: 400 })
    }
    
    if (selectedStartTime <= twoHoursLater) {
      console.log('❌ 時段太早:', {
        selectedStartTime: selectedStartTime.toISOString(),
        twoHoursLater: twoHoursLater.toISOString()
      })
      return NextResponse.json({ 
        error: '預約時段必須在現在時間的2小時之後',
        minTime: twoHoursLater.toISOString(),
        selectedTime: selectedStartTime.toISOString()
      }, { status: 400 })
    }

    // 轉換時間格式為 Date 對象
    // 確保日期格式正確（YYYY-MM-DD）
    const dateStr = normalizedDate.split('T')[0] // 移除時間部分（如果有）
    // 解析時間
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const [year, month, day] = dateStr.split('-').map(Number)
    
    // 驗證解析結果
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute) ||
        isNaN(year) || isNaN(month) || isNaN(day)) {
      console.log('❌ 無法解析時間或日期:', { startHour, startMinute, endHour, endMinute, year, month, day })
      return NextResponse.json({ 
        error: '時間或日期解析失敗',
        received: { date: normalizedDate, startTime, endTime }
      }, { status: 400 })
    }
    
    // 創建時間對象
    // 時段保存時，如果使用 new Date("2025-12-05T00:00:00")，會解析為 UTC 時間
    // 如果使用 new Date(2025, 11, 5, 0, 0, 0, 0)，會使用本地時間
    // 為了確保匹配，我們使用本地時間創建 Date 對象
    // JavaScript 會自動處理時區轉換，與數據庫存儲的 UTC 時間進行比較
    const startDateTime = new Date(year, month - 1, day, startHour, startMinute, 0, 0)
    const endDateTime = new Date(year, month - 1, day, endHour, endMinute, 0, 0)
    
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      console.log('❌ 創建的時間對象無效:', { startDateTime, endDateTime })
      return NextResponse.json({ 
        error: '時間對象創建失敗',
        received: { date: normalizedDate, startTime, endTime }
      }, { status: 400 })
    }
    
    // 驗證結束時間晚於開始時間
    if (endDateTime <= startDateTime) {
      console.log('❌ 結束時間必須晚於開始時間:', {
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString()
      })
      return NextResponse.json({ 
        error: '結束時間必須晚於開始時間',
        received: { startTime, endTime }
      }, { status: 400 })
    }
    
    console.log('🔵 創建的時間對象:', {
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      startDateTimeLocal: `${startDateTime.getFullYear()}-${String(startDateTime.getMonth() + 1).padStart(2, '0')}-${String(startDateTime.getDate()).padStart(2, '0')} ${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`,
      endDateTimeLocal: `${endDateTime.getFullYear()}-${String(endDateTime.getMonth() + 1).padStart(2, '0')}-${String(endDateTime.getDate()).padStart(2, '0')} ${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`
    })

    // 解析遊戲列表，統一轉為小寫以確保大小寫不敏感匹配
    const gameList = games 
      ? games.split(',').map(g => g.trim().toLowerCase()).filter(g => g.length > 0)
      : []

    console.log('🔍 ========== 開始搜索多人陪玩夥伴 ==========')
    console.log('🔍 搜索參數:', { 
      date: normalizedDate, 
      dateStr, 
      startTime, 
      endTime, 
      games: gameList,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      startDateTimeUTC: `${startDateTime.getUTCFullYear()}-${String(startDateTime.getUTCMonth() + 1).padStart(2, '0')}-${String(startDateTime.getUTCDate()).padStart(2, '0')} ${String(startDateTime.getUTCHours()).padStart(2, '0')}:${String(startDateTime.getUTCMinutes()).padStart(2, '0')}`,
      endDateTimeUTC: `${endDateTime.getUTCFullYear()}-${String(endDateTime.getUTCMonth() + 1).padStart(2, '0')}-${String(endDateTime.getUTCDate()).padStart(2, '0')} ${String(endDateTime.getUTCHours()).padStart(2, '0')}:${String(endDateTime.getUTCMinutes()).padStart(2, '0')}`
    })

    const result = await db.query(async (client) => {
      // 查詢時段時，需要匹配日期
      // 時段保存時，date 是 new Date("2025-12-05")，這會解析為 2025-12-05 00:00:00 UTC
      // 所以我們需要查詢該日期的 UTC 00:00:00 到 23:59:59
      // 為了確保不遺漏，擴大查詢範圍（前後各一天）
      const dateStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      const dateEndUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
      // 擴大查詢範圍（前後各一天）
      const expandedDateStart = new Date(dateStartUTC.getTime() - 24 * 60 * 60 * 1000)
      const expandedDateEnd = new Date(dateEndUTC.getTime() + 24 * 60 * 60 * 1000)

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
        dateStartUTC: dateStartUTC.toISOString(),
        dateEndUTC: dateEndUTC.toISOString(),
        expandedDateStart: expandedDateStart.toISOString(),
        expandedDateEnd: expandedDateEnd.toISOString()
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
                gte: expandedDateStart,
                lte: expandedDateEnd,
              },
              isAvailable: true
            }
          },
          // 遊戲篩選 - 使用大小寫不敏感的匹配
          // 注意：Prisma 的 hasSome 是大小寫敏感的，所以我們在查詢時不篩選遊戲
          // 而是在後續的 JavaScript 邏輯中進行大小寫不敏感的匹配
          // 這樣可以確保不會因為大小寫問題而漏掉夥伴
        },
        select: {
          id: true,
          name: true,
          games: true,
          halfHourlyRate: true,
          coverImage: true,
          images: true,
          isRankBooster: true,
          allowGroupBooking: true,
          user: {
            select: {
              email: true,
              discord: true,
              isSuspended: true,
              suspensionEndsAt: true,
              // 移除 reviewsReceived - 如果需要評分，可以通過其他 API 獲取
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
            take: 100, // 限制每個 partner 最多載入 100 個時段
          }
        },
        take: 100, // 限制最多 100 個夥伴
      })

      const queryTime = Date.now() - performanceStartTime
      console.log('📊 數據庫查詢結果:', {
        totalPartners: partners.length,
        partnersWithSchedules: partners.filter(p => p.schedules.length > 0).length,
        totalSchedules: partners.reduce((sum, p) => sum + p.schedules.length, 0),
        queryTime: `${queryTime}ms`
      })
      
      if (partners.length === 0) {
        console.log('⚠️ 數據庫查詢沒有找到任何已批准的夥伴')
        // 檢查是否有任何夥伴存在（不管狀態）
        const allPartnersCount = await client.partner.count()
        console.log('📊 數據庫中總夥伴數:', allPartnersCount)
        const approvedPartnersCount = await client.partner.count({
          where: { status: 'APPROVED' }
        })
        console.log('📊 已批准夥伴數:', approvedPartnersCount)
        
        // 檢查該日期是否有任何時段
        const schedulesOnDate = await client.schedule.findMany({
          where: {
            date: {
              gte: dateStartUTC,
              lte: dateEndUTC,
            },
            isAvailable: true
          },
          include: {
            partner: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          },
          take: 5 // 只取前5個作為示例
        })
        console.log('📅 該日期範圍內的時段:', schedulesOnDate.length)
        schedulesOnDate.forEach(s => {
          const sStart = new Date(s.startTime)
          const sEnd = new Date(s.endTime)
          const sDate = new Date(s.date)
          console.log(`  時段 ${s.id}:`, {
            partnerName: s.partner.name,
            partnerStatus: s.partner.status,
            date: sDate.toISOString().split('T')[0],
            startTime: sStart.toISOString(),
            endTime: sEnd.toISOString(),
            startTimeLocal: `${sStart.getHours()}:${String(sStart.getMinutes()).padStart(2, '0')}`,
            endTimeLocal: `${sEnd.getHours()}:${String(sEnd.getMinutes()).padStart(2, '0')}`,
            isAvailable: s.isAvailable
          })
        })
      } else {
        // 如果有夥伴，檢查他們的時段詳情
        console.log('📋 找到的夥伴及其時段詳情（前3個）:')
        partners.slice(0, 3).forEach(p => {
          console.log(`  夥伴 ${p.name} (${p.id}):`, {
            schedulesCount: p.schedules.length,
            schedules: p.schedules.map(s => {
              const sStart = new Date(s.startTime)
              const sEnd = new Date(s.endTime)
              const sDate = new Date(s.date)
              return {
                id: s.id,
                date: sDate.toISOString().split('T')[0],
                startTime: sStart.toISOString(),
                endTime: sEnd.toISOString(),
                startTimeLocal: `${sStart.getHours()}:${String(sStart.getMinutes()).padStart(2, '0')}`,
                endTimeLocal: `${sEnd.getHours()}:${String(sEnd.getMinutes()).padStart(2, '0')}`,
                isAvailable: s.isAvailable,
                hasBooking: !!s.bookings
              }
            })
          })
        })
      }

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
          // 遊戲篩選：如果指定了遊戲，檢查夥伴是否有匹配的遊戲（大小寫不敏感）
          if (gameList.length > 0) {
            const partnerGames = (partner.games || []).map((g: string) => g.toLowerCase())
            const hasMatchingGame = gameList.some(searchGame => 
              partnerGames.some(partnerGame => partnerGame === searchGame)
            )
            if (!hasMatchingGame) {
              return null
            }
          }
          
          // 計算平均星等
          // 注意：reviewsReceived 已移除以優化效能，如果需要評分可以通過其他 API 獲取
          // 暫時設為 0，或可以通過單獨的 API 查詢評分
          const averageRating = 0;
          
          // 找到符合時段的 schedule
          // 檢查搜尋的時段是否完全包含在夥伴的可用時段內
          // 即：時段開始時間 <= 搜尋開始時間 且 時段結束時間 >= 搜尋結束時間
          const matchingSchedule = partner.schedules.find(schedule => {
            const scheduleStart = new Date(schedule.startTime)
            const scheduleEnd = new Date(schedule.endTime)
            const scheduleDate = new Date(schedule.date)
            
            // 檢查日期是否匹配 - 使用 UTC 日期進行比較
            // 因為數據庫存儲的是 UTC 時間，我們需要比較 UTC 日期
            const scheduleDateUTC = `${scheduleDate.getUTCFullYear()}-${String(scheduleDate.getUTCMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getUTCDate()).padStart(2, '0')}`
            const searchDateUTC = `${startDateTime.getUTCFullYear()}-${String(startDateTime.getUTCMonth() + 1).padStart(2, '0')}-${String(startDateTime.getUTCDate()).padStart(2, '0')}`
            const isDateMatch = scheduleDateUTC === searchDateUTC
            
            if (!isDateMatch) {
              console.log('🔍 日期不匹配:', {
                scheduleDateUTC,
                searchDateUTC,
                scheduleDateISO: scheduleDate.toISOString(),
                searchDateISO: startDateTime.toISOString()
              })
              return false
            }
            
            // 檢查時間：搜尋的時段必須完全包含在夥伴的時段內
            // 使用完整的 Date 對象進行比較（都是 UTC 時間）
            // 時段開始時間 <= 搜尋開始時間 且 時段結束時間 >= 搜尋結束時間
            const isTimeContained = scheduleStart.getTime() <= startDateTime.getTime() && scheduleEnd.getTime() >= endDateTime.getTime()
            
            // 檢查是否有活躍的預約
            // 注意：Schedule.bookings 是單個對象（Booking?），不是數組
            const hasActiveBooking = schedule.bookings && 
              schedule.bookings.status !== 'CANCELLED' && 
              schedule.bookings.status !== 'REJECTED'
            
            // 為了調試，計算時間差（使用 UTC 時間）
            const scheduleStartTime = scheduleStart.getTime()
            const scheduleEndTime = scheduleEnd.getTime()
            const searchStartTime = startDateTime.getTime()
            const searchEndTime = endDateTime.getTime()
            
            // 計算時間差（毫秒）
            const startDiffMs = searchStartTime - scheduleStartTime
            const endDiffMs = scheduleEndTime - searchEndTime
            
            console.log('🔍 檢查時段:', {
              partnerName: partner.name,
              scheduleId: schedule.id,
              scheduleDateUTC,
              searchDateUTC,
              scheduleStartISO: scheduleStart.toISOString(),
              scheduleEndISO: scheduleEnd.toISOString(),
              searchStartISO: startDateTime.toISOString(),
              searchEndISO: endDateTime.toISOString(),
              scheduleTimeUTC: `${scheduleStart.getUTCHours()}:${String(scheduleStart.getUTCMinutes()).padStart(2, '0')} - ${scheduleEnd.getUTCHours()}:${String(scheduleEnd.getUTCMinutes()).padStart(2, '0')}`,
              searchTimeUTC: `${startDateTime.getUTCHours()}:${String(startDateTime.getUTCMinutes()).padStart(2, '0')} - ${endDateTime.getUTCHours()}:${String(endDateTime.getUTCMinutes()).padStart(2, '0')}`,
              scheduleStartTime,
              scheduleEndTime,
              searchStartTime,
              searchEndTime,
              startDiffMs: `${startDiffMs}ms (${Math.round(startDiffMs / 60000)}分鐘)`,
              endDiffMs: `${endDiffMs}ms (${Math.round(endDiffMs / 60000)}分鐘)`,
              isDateMatch,
              isTimeContained: isTimeContained,
              timeCheck: {
                startCheck: `${scheduleStartTime} <= ${searchStartTime} = ${scheduleStartTime <= searchStartTime}`,
                endCheck: `${scheduleEndTime} >= ${searchEndTime} = ${scheduleEndTime >= searchEndTime}`
              },
              isAvailable: schedule.isAvailable,
              hasActiveBooking,
              willMatch: isDateMatch && isTimeContained && schedule.isAvailable && !hasActiveBooking
            })
            
            return isDateMatch &&
                   isTimeContained &&
                   schedule.isAvailable &&
                   !hasActiveBooking
          })
          
          if (!matchingSchedule) return null
          
          return {
            ...partner,
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews: 0, // 已移除以優化效能，如果需要可以通過其他 API 獲取
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

    const endTimestamp = Date.now()
    const duration = endTimestamp - performanceStartTime
    console.log('📤 返回結果:', result.length, '位夥伴')
    console.log('⏱️ 總執行時間:', duration, 'ms')
    return NextResponse.json(result)
  } catch (error: any) {
    const endTimestamp = Date.now()
    const duration = endTimestamp - performanceStartTime
    console.error('❌ ========== 搜索失敗 ==========')
    console.error('❌ 錯誤類型:', error?.constructor?.name)
    console.error('❌ 錯誤訊息:', error?.message)
    console.error('❌ 錯誤堆疊:', error?.stack)
    console.error('⏱️ 失敗時間:', duration, 'ms')
    
    // 確保返回錯誤響應
    return NextResponse.json(
      { 
        error: '搜尋夥伴失敗',
        message: error?.message || '未知錯誤',
        duration: duration
      },
      { status: 500 }
    )
  }
}

