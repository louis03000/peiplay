import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  // ========== 調試日誌開始 ==========
  console.log('\n' + '='.repeat(80))
  console.log('🚀 [多人陪玩搜索] API 被調用')
  console.log('='.repeat(80))
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('❌ [多人陪玩搜索] 未授權')
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const games = searchParams.get('games')
    const debug = searchParams.get('debug') === 'true' // 調試模式
    
    console.log('📥 [多人陪玩搜索] 收到請求參數:', { date, startTime, endTime, games, debug })
    
    // 調試信息收集器
    const debugInfo: any = {
      requestParams: { date, startTime, endTime, games },
      steps: [],
      partners: [],
      finalResult: null,
    }

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

    // 創建時間對象（使用本地時間，因為夥伴的時段也是以本地時間設置的）
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const [year, month, day] = normalizedDate.split('-').map(Number)
    
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute) ||
        isNaN(year) || isNaN(month) || isNaN(day)) {
      return NextResponse.json({ error: '時間或日期解析失敗' }, { status: 400 })
    }
    
    // 使用本地時間創建，與夥伴設置時段的時區一致
    const startDateTime = new Date(year, month - 1, day, startHour, startMinute, 0, 0)
    const endDateTime = new Date(year, month - 1, day, endHour, endMinute, 0, 0)
    
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

    // 調試日誌：搜索參數
    console.log('🔍 [多人陪玩搜索] 搜索參數:', {
      date: normalizedDate,
      startTime,
      endTime,
      games: gameList,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      startDateTimeLocal: `${startDateTime.getFullYear()}-${String(startDateTime.getMonth() + 1).padStart(2, '0')}-${String(startDateTime.getDate()).padStart(2, '0')} ${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`,
      endDateTimeLocal: `${endDateTime.getFullYear()}-${String(endDateTime.getMonth() + 1).padStart(2, '0')}-${String(endDateTime.getDate()).padStart(2, '0')} ${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`,
    })

    const result = await db.query(async (client) => {
      // 查詢日期範圍（擴大範圍以確保不遺漏）
      const dateStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      const dateEndUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
      const expandedDateStart = new Date(dateStartUTC.getTime() - 24 * 60 * 60 * 1000)
      const expandedDateEnd = new Date(dateEndUTC.getTime() + 24 * 60 * 60 * 1000)

      console.log('📅 [多人陪玩搜索] 查詢日期範圍:', {
        dateStartUTC: dateStartUTC.toISOString(),
        dateEndUTC: dateEndUTC.toISOString(),
        expandedDateStart: expandedDateStart.toISOString(),
        expandedDateEnd: expandedDateEnd.toISOString(),
      })
      
      if (debug) {
        debugInfo.steps.push({
          step: '查詢日期範圍',
          dateStartUTC: dateStartUTC.toISOString(),
          dateEndUTC: dateEndUTC.toISOString(),
          expandedDateStart: expandedDateStart.toISOString(),
          expandedDateEnd: expandedDateEnd.toISOString(),
        })
      }

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
            orderBy: [
              // 優先排序：搜索日期當天的時段排在前面
              { date: 'asc' },
              { startTime: 'asc' }
            ],
            take: 200, // 增加數量以確保不遺漏
          }
        },
        take: 100,
      })

      console.log(`📊 [多人陪玩搜索] 查詢結果: 找到 ${partners.length} 個開啟群組預約的夥伴`)
      if (partners.length > 0) {
        console.log('👥 [多人陪玩搜索] 夥伴列表:', partners.map(p => ({
          id: p.id,
          name: p.name,
          allowGroupBooking: true, // 已經篩選過
          schedulesCount: p.schedules.length,
          games: p.games,
          schedules: p.schedules.map(s => ({
            id: s.id,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            dateUTC: `${new Date(s.date).getUTCFullYear()}-${String(new Date(s.date).getUTCMonth() + 1).padStart(2, '0')}-${String(new Date(s.date).getUTCDate()).padStart(2, '0')}`,
            startTimeUTC: `${new Date(s.startTime).getUTCFullYear()}-${String(new Date(s.startTime).getUTCMonth() + 1).padStart(2, '0')}-${String(new Date(s.startTime).getUTCDate()).padStart(2, '0')} ${String(new Date(s.startTime).getUTCHours()).padStart(2, '0')}:${String(new Date(s.startTime).getUTCMinutes()).padStart(2, '0')}`,
            endTimeUTC: `${new Date(s.endTime).getUTCFullYear()}-${String(new Date(s.endTime).getUTCMonth() + 1).padStart(2, '0')}-${String(new Date(s.endTime).getUTCDate()).padStart(2, '0')} ${String(new Date(s.endTime).getUTCHours()).padStart(2, '0')}:${String(new Date(s.endTime).getUTCMinutes()).padStart(2, '0')}`,
          })),
        })))
      }
      
      if (debug) {
        debugInfo.steps.push({
          step: '數據庫查詢結果',
          partnersFound: partners.length,
          partners: partners.map(p => ({
            id: p.id,
            name: p.name,
            schedulesCount: p.schedules.length,
            games: p.games,
            schedules: p.schedules.map(s => ({
              id: s.id,
              date: s.date,
              startTime: s.startTime,
              endTime: s.endTime,
              isAvailable: s.isAvailable,
              hasBooking: !!s.bookings,
              bookingStatus: s.bookings?.status || null,
            })),
          })),
        })
      }

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

      console.log(`✅ [多人陪玩搜索] 停權篩選後: ${availablePartners.length} 個可用夥伴`)
      
      if (debug) {
        debugInfo.steps.push({
          step: '停權篩選',
          partnersAfterSuspensionFilter: availablePartners.length,
        })
      }

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
              console.log(`🎮 [多人陪玩搜索] 夥伴 ${partner.name} (${partner.id}) 被遊戲篩選排除:`, {
                partnerGames,
                searchGames: gameList,
              })
              return null
            }
          }
          
          // 找到符合時段的 schedule
          console.log(`🔎 [多人陪玩搜索] 檢查夥伴 ${partner.name} (${partner.id}) 的 ${partner.schedules.length} 個時段`)
          
          // 初始化夥伴調試信息
          if (debug) {
            const partnerDebug = debugInfo.partners.find((p: any) => p.partnerId === partner.id) || {
              partnerId: partner.id,
              partnerName: partner.name,
              scheduleChecks: [],
            }
            if (!debugInfo.partners.find((p: any) => p.partnerId === partner.id)) {
              debugInfo.partners.push(partnerDebug)
            }
          }
          
          // 記錄所有時段的原始數據（用於調試）
          if (debug && partner.schedules.length > 0) {
            console.log(`📋 [多人陪玩搜索] 夥伴 ${partner.name} 的所有時段原始數據:`, partner.schedules.map(s => ({
              id: s.id,
              date: s.date,
              startTime: s.startTime,
              endTime: s.endTime,
              isAvailable: s.isAvailable,
              bookingStatus: s.bookings?.status || null,
            })))
          }
          
          const matchingSchedule = partner.schedules.find(schedule => {
            const scheduleStart = new Date(schedule.startTime)
            const scheduleEnd = new Date(schedule.endTime)
            const scheduleDate = new Date(schedule.date)
            
            // 記錄原始數據（用於調試）
            console.log(`🔍 [多人陪玩搜索] 檢查時段 ${schedule.id}:`, {
              rawDate: schedule.date,
              rawStartTime: schedule.startTime,
              rawEndTime: schedule.endTime,
              parsedDate: scheduleDate.toISOString(),
              parsedStartTime: scheduleStart.toISOString(),
              parsedEndTime: scheduleEnd.toISOString(),
            })
            
            // 檢查日期是否匹配（使用本地日期比較）
            // 注意：date 字段是夥伴設置的日期，應該用這個來匹配
            const scheduleDateLocal = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`
            const searchDateLocal = `${startDateTime.getFullYear()}-${String(startDateTime.getMonth() + 1).padStart(2, '0')}-${String(startDateTime.getDate()).padStart(2, '0')}`
            const isDateMatch = scheduleDateLocal === searchDateLocal
            
            // 提取本地時間部分（用於顯示和調試）
            const scheduleStartLocalTime = `${String(scheduleStart.getHours()).padStart(2, '0')}:${String(scheduleStart.getMinutes()).padStart(2, '0')}`
            const scheduleEndLocalTime = `${String(scheduleEnd.getHours()).padStart(2, '0')}:${String(scheduleEnd.getMinutes()).padStart(2, '0')}`
            const searchStartLocalTime = `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`
            const searchEndLocalTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`
            
            // 計算 scheduleStart 和 scheduleEnd 的實際本地日期（用於正確顯示時段）
            const scheduleStartDateLocal = `${scheduleStart.getFullYear()}-${String(scheduleStart.getMonth() + 1).padStart(2, '0')}-${String(scheduleStart.getDate()).padStart(2, '0')}`
            const scheduleEndDateLocal = `${scheduleEnd.getFullYear()}-${String(scheduleEnd.getMonth() + 1).padStart(2, '0')}-${String(scheduleEnd.getDate()).padStart(2, '0')}`
            
            if (!isDateMatch) {
              console.log(`📅 [多人陪玩搜索] 時段 ${schedule.id} 日期不匹配:`, {
                scheduleDate: scheduleDate.toISOString(),
                scheduleDateLocal,
                scheduleStartDateLocal,
                scheduleEndDateLocal,
                searchDateLocal,
                isDateMatch,
              })
              
              if (debug) {
                const partnerDebug = debugInfo.partners.find((p: any) => p.partnerId === partner.id)!
                // 組合後的時段（使用實際的本地日期 + 本地時間，而不是 schedule.date）
                // 因為 schedule.startTime 和 schedule.date 可能對應不同的日期
                const scheduleStartCombinedLocal = `${scheduleStartDateLocal} ${scheduleStartLocalTime}`
                const scheduleEndCombinedLocal = `${scheduleEndDateLocal} ${scheduleEndLocalTime}`
                
                partnerDebug.scheduleChecks.push({
                  scheduleId: schedule.id,
                  reason: '日期不匹配',
                  scheduleDate: scheduleDate.toISOString(),
                  scheduleDateLocal,
                  scheduleStartCombinedLocal,
                  scheduleEndCombinedLocal,
                  searchDateLocal,
                  searchStartLocal: `${searchDateLocal} ${searchStartLocalTime}`,
                  searchEndLocal: `${searchDateLocal} ${searchEndLocalTime}`,
                  isDateMatch: false,
                  finalMatch: false,
                })
              }
              
              return false
            }
            
            // 檢查時間：搜尋的時段必須完全包含在夥伴的時段內
            // 重要：startTime/endTime 存儲的是完整的日期時間（UTC），但我們需要提取其本地時間部分
            // 因為 startTime 可能是以本地時間創建的，存儲時轉換為 UTC，所以需要還原回本地時間
            // 方法：將 startTime 轉換為本地時間，提取小時和分鐘，然後與搜索日期組合
            const scheduleStartLocalHours = scheduleStart.getHours()    // 本地時間的小時
            const scheduleStartLocalMinutes = scheduleStart.getMinutes() // 本地時間的分鐘
            const scheduleEndLocalHours = scheduleEnd.getHours()        // 本地時間的小時
            const scheduleEndLocalMinutes = scheduleEnd.getMinutes()    // 本地時間的分鐘
            
            // 使用 date 字段的日期（本地時間）+ startTime/endTime 的本地時間部分來組合
            const scheduleStartOnSearchDate = new Date(
              scheduleDate.getFullYear(),      // 使用 date 字段的年份（本地）
              scheduleDate.getMonth(),         // 使用 date 字段的月份（本地）
              scheduleDate.getDate(),          // 使用 date 字段的日期（本地）
              scheduleStartLocalHours,         // 使用 startTime 的本地時間部分
              scheduleStartLocalMinutes,       // 使用 startTime 的本地時間部分
              0,
              0
            )
            const scheduleEndOnSearchDate = new Date(
              scheduleDate.getFullYear(),      // 使用 date 字段的年份（本地）
              scheduleDate.getMonth(),         // 使用 date 字段的月份（本地）
              scheduleDate.getDate(),          // 使用 date 字段的日期（本地）
              scheduleEndLocalHours,           // 使用 endTime 的本地時間部分
              scheduleEndLocalMinutes,         // 使用 endTime 的本地時間部分
              0,
              0
            )
            
            // 夥伴的時段開始時間 <= 搜尋開始時間 且 夥伴的時段結束時間 >= 搜尋結束時間
            const isTimeContained = scheduleStartOnSearchDate.getTime() <= startDateTime.getTime() && 
                                   scheduleEndOnSearchDate.getTime() >= endDateTime.getTime()
            
            // 檢查是否有活躍的預約（bookings 是一對一關係，可能是 null 或單個對象）
            // 只排除真正活躍的預約狀態
            const hasActiveBooking = schedule.bookings && 
              schedule.bookings.status !== 'CANCELLED' && 
              schedule.bookings.status !== 'REJECTED' &&
              schedule.bookings.status !== 'COMPLETED'
            
            // 確保所有條件都滿足
            const isAvailable = schedule.isAvailable && !hasActiveBooking
            
            // 組合後的時段（用於匹配的實際時段，使用本地時間）
            const scheduleStartCombinedLocal = `${scheduleDateLocal} ${scheduleStartLocalTime}`
            const scheduleEndCombinedLocal = `${scheduleDateLocal} ${scheduleEndLocalTime}`
            
            const matchResult = {
              scheduleId: schedule.id,
              // 原始数据（從數據庫讀取的，僅用於調試）
              rawScheduleDate: scheduleDate.toISOString(),
              rawScheduleStart: scheduleStart.toISOString(),
              rawScheduleEnd: scheduleEnd.toISOString(),
              // 組合後的時段（實際用於匹配的時段，本地時間）
              scheduleDateLocal: scheduleDateLocal,
              scheduleStartCombined: scheduleStartOnSearchDate.toISOString(),
              scheduleEndCombined: scheduleEndOnSearchDate.toISOString(),
              scheduleStartCombinedLocal: scheduleStartCombinedLocal,
              scheduleEndCombinedLocal: scheduleEndCombinedLocal,
              // 搜索时间（本地時間）
              searchStart: startDateTime.toISOString(),
              searchEnd: endDateTime.toISOString(),
              searchStartLocal: `${searchDateLocal} ${searchStartLocalTime}`,
              searchEndLocal: `${searchDateLocal} ${searchEndLocalTime}`,
              // 时间戳比较
              scheduleStartTimestamp: scheduleStartOnSearchDate.getTime(),
              scheduleEndTimestamp: scheduleEndOnSearchDate.getTime(),
              searchStartTimestamp: startDateTime.getTime(),
              searchEndTimestamp: endDateTime.getTime(),
              // 匹配结果
              isDateMatch,
              isTimeContained,
              timeContainedDetails: {
                startCheck: `${scheduleStartOnSearchDate.getTime()} <= ${startDateTime.getTime()} = ${scheduleStartOnSearchDate.getTime() <= startDateTime.getTime()}`,
                endCheck: `${scheduleEndOnSearchDate.getTime()} >= ${endDateTime.getTime()} = ${scheduleEndOnSearchDate.getTime() >= endDateTime.getTime()}`,
              },
              scheduleIsAvailable: schedule.isAvailable,
              hasActiveBooking: !!hasActiveBooking,
              bookingStatus: schedule.bookings?.status || null,
              isAvailable,
              finalMatch: isDateMatch && isTimeContained && isAvailable,
            }
            
            console.log(`⏰ [多人陪玩搜索] 時段 ${schedule.id} 匹配檢查:`, matchResult)
            
            if (debug) {
              const partnerDebug = debugInfo.partners.find((p: any) => p.partnerId === partner.id) || {
                partnerId: partner.id,
                partnerName: partner.name,
                scheduleChecks: [],
              }
              if (!debugInfo.partners.find((p: any) => p.partnerId === partner.id)) {
                debugInfo.partners.push(partnerDebug)
              }
              partnerDebug.scheduleChecks.push(matchResult)
            }
            
            return isDateMatch && isTimeContained && isAvailable
          })
          
          if (!matchingSchedule) {
            console.log(`❌ [多人陪玩搜索] 夥伴 ${partner.name} (${partner.id}) 沒有符合條件的時段`)
            
            if (debug) {
              const partnerDebug = debugInfo.partners.find((p: any) => p.partnerId === partner.id)
              if (partnerDebug) {
                partnerDebug.finalStatus = '沒有符合條件的時段'
              }
            }
            
            return null
          }
          
          console.log(`✅ [多人陪玩搜索] 夥伴 ${partner.name} (${partner.id}) 找到匹配時段:`, {
            scheduleId: matchingSchedule.id,
            startTime: matchingSchedule.startTime,
            endTime: matchingSchedule.endTime,
          })
          
          if (debug) {
            const partnerDebug = debugInfo.partners.find((p: any) => p.partnerId === partner.id)
            if (partnerDebug) {
              partnerDebug.finalStatus = '匹配成功'
              partnerDebug.matchingSchedule = {
                id: matchingSchedule.id,
                startTime: matchingSchedule.startTime,
                endTime: matchingSchedule.endTime,
              }
            }
          }
          
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

      console.log(`🎯 [多人陪玩搜索] 最終結果: 找到 ${partnersWithAvailableSchedules.length} 個符合條件的夥伴`)
      if (partnersWithAvailableSchedules.length > 0) {
        console.log('✅ [多人陪玩搜索] 匹配的夥伴:', partnersWithAvailableSchedules.map(p => ({
          id: p.id,
          name: p.name,
          matchingSchedule: p.matchingSchedule,
        })))
      } else {
        console.log('⚠️ [多人陪玩搜索] 沒有找到符合條件的夥伴，可能的原因:')
        console.log('  - 沒有夥伴開啟群組預約')
        console.log('  - 夥伴在該日期沒有可用時段')
        console.log('  - 時段時間不匹配')
        console.log('  - 時段已被預約')
      }
      
      if (debug) {
        debugInfo.finalResult = {
          partnersFound: partnersWithAvailableSchedules.length,
          partners: partnersWithAvailableSchedules,
        }
        debugInfo.searchParams = {
          normalizedDate,
          startTime,
          endTime,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          startDateTimeLocal: `${startDateTime.getFullYear()}-${String(startDateTime.getMonth() + 1).padStart(2, '0')}-${String(startDateTime.getDate()).padStart(2, '0')} ${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`,
          endDateTimeLocal: `${endDateTime.getFullYear()}-${String(endDateTime.getMonth() + 1).padStart(2, '0')}-${String(endDateTime.getDate()).padStart(2, '0')} ${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`,
        }
      }

      return partnersWithAvailableSchedules
    }, 'partners/search-for-multi-player')

    console.log('='.repeat(80))
    console.log('✅ [多人陪玩搜索] API 執行完成，返回結果')
    console.log('='.repeat(80) + '\n')
    
    // 如果啟用調試模式，將調試信息一起返回
    if (debug) {
      return NextResponse.json({
        partners: result,
        debug: debugInfo,
      })
    }
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('='.repeat(80))
    console.error('❌ [多人陪玩搜索] 搜索失敗:', error)
    console.error('錯誤堆疊:', error?.stack)
    console.error('='.repeat(80) + '\n')
    
    return NextResponse.json(
      { 
        error: '搜尋夥伴失敗',
        message: error?.message || '未知錯誤'
      },
      { status: 500 }
    )
  }
}

