import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

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

    // 解析日期和時間
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const [year, month, day] = normalizedDate.split('-').map(Number)
    
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute) ||
        isNaN(year) || isNaN(month) || isNaN(day)) {
      return NextResponse.json({ error: '時間或日期解析失敗' }, { status: 400 })
    }
    
    // 重要：前端傳來的是台灣本地時間（UTC+8）
    // 使用 dayjs 正確將台灣時間轉換為 UTC 時間戳
    const dateTimeString = `${normalizedDate} ${startTime}`
    
    // 🔥 處理跨日情況：如果結束時間小於開始時間，視為隔天
    let endDate = normalizedDate
    if (endHour < startHour || (endHour === startHour && endMinute < startMinute)) {
      // 將結束日期加一天
      const endDateObj = dayjs.tz(`${normalizedDate} 00:00`, 'Asia/Taipei')
      endDate = endDateObj.add(1, 'day').format('YYYY-MM-DD')
      console.log('🔄 [多人陪玩搜索] 檢測到跨日時間段，結束日期調整為:', endDate)
    }
    
    const endDateTimeString = `${endDate} ${endTime}`
    
    const startDateTimeUTC = dayjs
      .tz(dateTimeString, 'Asia/Taipei')
      .utc()
      .toDate()
    
    const endDateTimeUTC = dayjs
      .tz(endDateTimeString, 'Asia/Taipei')
      .utc()
      .toDate()
    
    if (!startDateTimeUTC || !endDateTimeUTC || isNaN(startDateTimeUTC.getTime()) || isNaN(endDateTimeUTC.getTime())) {
      return NextResponse.json({ error: '時間對象創建失敗' }, { status: 400 })
    }
    
    // 🔥 修正跨日驗證：現在已經處理了跨日情況，所以這裡只需要確保結束時間大於開始時間
    if (endDateTimeUTC <= startDateTimeUTC) {
      return NextResponse.json({ error: '結束時間必須晚於開始時間' }, { status: 400 })
    }
    
    // ⚠️ 時間比較：使用 UTC，不再轉換
    const now = new Date() // UTC
    
    // 🔥 移除「必須預約兩小時後」的限制，允許立即搜索
    
    // 調試：驗證時間轉換（只顯示 UTC）
    console.log('⏰ [多人陪玩搜索] 時間轉換驗證 (UTC):', {
      input: `${normalizedDate} ${startTime}`,
      searchStartUTC: startDateTimeUTC.toISOString(),
    })

    // 解析遊戲列表
    const gameList = games 
      ? games.split(',').map(g => g.trim().toLowerCase()).filter(g => g.length > 0)
      : []

    // 調試日誌：搜索參數（只顯示 UTC，避免混用）
    console.log('🔍 [多人陪玩搜索] 搜索參數 (UTC):', {
      date: normalizedDate,
      startTime,
      endTime,
      games: gameList,
      startDateTimeUTC: startDateTimeUTC.toISOString(),
      endDateTimeUTC: endDateTimeUTC.toISOString(),
    })

    const result = await db.query(async (client) => {
      // 直接使用時間範圍查詢，不再用 date 字段過濾
      // 擴大查詢範圍：搜索開始時間的前後各 24 小時
      const expandedStart = new Date(startDateTimeUTC.getTime() - 24 * 60 * 60 * 1000)
      const expandedEnd = new Date(endDateTimeUTC.getTime() + 24 * 60 * 60 * 1000)

      console.log('📅 [多人陪玩搜索] 查詢時間範圍 (UTC):', {
        searchStartUTC: startDateTimeUTC.toISOString(),
        searchEndUTC: endDateTimeUTC.toISOString(),
        expandedStart: expandedStart.toISOString(),
        expandedEnd: expandedEnd.toISOString(),
      })
      
      if (debug) {
        debugInfo.steps.push({
          step: '查詢時間範圍',
          searchStartUTC: startDateTimeUTC.toISOString(),
          searchEndUTC: endDateTimeUTC.toISOString(),
          expandedStart: expandedStart.toISOString(),
          expandedEnd: expandedEnd.toISOString(),
        })
      }

      // 🔥 先查詢所有有活躍預約的時段 ID（排除 CANCELLED、REJECTED、COMPLETED）
      const bookedScheduleIds = await client.booking.findMany({
        where: {
          status: {
            notIn: ['CANCELLED', 'REJECTED', 'COMPLETED']
          },
          schedule: {
            startTime: {
              lte: expandedEnd,
            },
            endTime: {
              gte: expandedStart,
            },
          }
        },
        select: {
          scheduleId: true,
        },
        distinct: ['scheduleId'],
      })
      
      const bookedScheduleIdSet = new Set(bookedScheduleIds.map(b => b.scheduleId).filter(Boolean))
      console.log(`🚫 [多人陪玩搜索] 找到 ${bookedScheduleIdSet.size} 個已被預約的時段`)
      
      // 查詢已批准且開啟群組預約的夥伴
      // 直接在 Prisma 查詢中過濾時間：startTime <= searchEnd 且 endTime >= searchStart
      // 🔥 排除已被預約的時段
      const partners = await client.partner.findMany({
        where: {
          status: 'APPROVED',
          allowGroupBooking: true, // 只查詢開啟群組預約的夥伴
          schedules: {
            some: {
              startTime: {
                lte: expandedEnd, // 時段開始時間不晚於擴展結束時間
              },
              endTime: {
                gte: expandedStart, // 時段結束時間不早於擴展開始時間
              },
              isAvailable: true,
              // 🔥 排除已被預約的時段
              id: {
                notIn: Array.from(bookedScheduleIdSet)
              }
            }
          },
        },
        select: {
          id: true,
          name: true,
          games: true,
          halfHourlyRate: true,
          coverImage: true,
          images: true,
          isAvailableNow: true,
          isRankBooster: true,
          rankBoosterImages: true,
          supportsChatOnly: true,
          chatOnlyRate: true,
          customerMessage: true,
          user: {
            select: {
              email: true,
              isSuspended: true,
              suspensionEndsAt: true,
            }
          },
          schedules: {
            where: {
              startTime: {
                lte: expandedEnd, // 時段開始時間不晚於擴展結束時間
              },
              endTime: {
                gte: expandedStart, // 時段結束時間不早於擴展開始時間
              },
              isAvailable: true,
              // 🔥 排除已被預約的時段
              id: {
                notIn: Array.from(bookedScheduleIdSet)
              }
            },
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              isAvailable: true,
              // 🔥 不再查詢 bookings，因為已經在 where 條件中排除了
            },
            orderBy: [
              // 按開始時間排序
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
              hasBooking: bookedScheduleIdSet.has(s.id),
              bookingStatus: bookedScheduleIdSet.has(s.id) ? 'BOOKED' : null,
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
      // 先進行遊戲篩選（在時段檢查之前）
      const gameFilteredPartners: typeof availablePartners = []
      const gameFilteredOut: typeof availablePartners = []
      
      // 遊戲匹配函數：支援多選遊戲（預留擴充）
      const matchGames = (partnerGames: string[], searchGames: string[]): boolean => {
        if (!searchGames || searchGames.length === 0) return true
        const normalizedPartnerGames = partnerGames.map(g => g.toLowerCase().trim())
        const normalizedSearchGames = searchGames.map(g => g.toLowerCase().trim())
        return normalizedSearchGames.some(searchGame => 
          normalizedPartnerGames.includes(searchGame)
        )
      }
      
      // 對每個伙伴進行遊戲篩選
      for (const partner of availablePartners) {
        const partnerGames = partner.games || []
        const gameMatch = matchGames(partnerGames, gameList)
        
        // 記錄遊戲檢查結果到 debug
        if (debug) {
          const partnerDebug = {
            partnerId: partner.id,
            partnerName: partner.name,
            scheduleChecks: [],
            gameCheck: {
              searchGames: gameList,
              partnerGames: partnerGames,
              isMatch: gameMatch,
            },
          }
          debugInfo.partners.push(partnerDebug)
        }
        
        if (gameList.length > 0 && !gameMatch) {
          // 遊戲不符合，直接跳過，不進入 schedule matching
          console.log(`🎮 [多人陪玩搜索] 夥伴 ${partner.name} (${partner.id}) 被遊戲篩選排除:`, {
            partnerGames,
            searchGames: gameList,
            reason: '夥伴沒有匹配的遊戲',
          })
          
          if (debug) {
            const partnerDebug = debugInfo.partners.find((p: any) => p.partnerId === partner.id)!
            partnerDebug.finalStatus = '遊戲不符合'
            partnerDebug.gameFilterReason = {
              requiredGames: gameList,
              partnerGames: partnerGames,
              missingGames: gameList.filter(g => !partnerGames.map(pg => pg.toLowerCase().trim()).includes(g.toLowerCase().trim())),
            }
          }
          
          gameFilteredOut.push(partner)
          continue
        }
        
        // 通過遊戲篩選
        if (gameList.length > 0) {
          console.log(`✅ [多人陪玩搜索] 夥伴 ${partner.name} (${partner.id}) 通過遊戲篩選:`, {
            partnerGames,
            searchGames: gameList,
            matchingGames: gameList.filter(g => partnerGames.map(pg => pg.toLowerCase().trim()).includes(g.toLowerCase().trim())),
          })
        }
        
        gameFilteredPartners.push(partner)
      }
      
      console.log(`🎮 [多人陪玩搜索] 遊戲篩選結果: ${availablePartners.length} -> ${gameFilteredPartners.length} 個夥伴 (排除 ${gameFilteredOut.length} 個)`)
      
      // 然後檢查時段
      const partnersWithAvailableSchedules = gameFilteredPartners
        .map(partner => {
          // 找到符合時段的 schedule（遊戲篩選已通過）
          console.log(`🔎 [多人陪玩搜索] 檢查夥伴 ${partner.name} (${partner.id}) 的 ${partner.schedules.length} 個時段`)
          
          // 確保 debug 信息已存在（遊戲篩選階段已創建，這裡只確保存在）
          if (debug) {
            const partnerDebug = debugInfo.partners.find((p: any) => p.partnerId === partner.id)
            if (!partnerDebug) {
              // 如果不存在（理論上不應該發生，因為遊戲篩選階段已創建），創建一個
              debugInfo.partners.push({
                partnerId: partner.id,
                partnerName: partner.name,
                scheduleChecks: [],
                gameCheck: {
                  searchGames: gameList,
                  partnerGames: partner.games || [],
                  isMatch: true,
                },
              })
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
              bookingStatus: bookedScheduleIdSet.has(s.id) ? 'BOOKED' : null,
            })))
          }
          
          // 檢查多個連續 schedule 是否能覆蓋搜索區間
          // Step 1: 過濾相關的 schedule（與搜索區間有重疊的）
          const relevantSchedules = partner.schedules
            .filter(schedule => {
              const scheduleStart = new Date(schedule.startTime)
              const scheduleEnd = new Date(schedule.endTime)
              
              // 檢查是否有重疊：schedule 與搜索區間有交集
              const hasOverlap = scheduleStart.getTime() < endDateTimeUTC.getTime() && 
                                scheduleEnd.getTime() > startDateTimeUTC.getTime()
              
              // 🔥 檢查是否可用（無活躍預約）
              // 注意：已在查詢時排除了已被預約的時段，所以這裡只需要檢查 isAvailable
              // 但為了安全起見，再次檢查是否在 bookedScheduleIdSet 中
              const isBooked = bookedScheduleIdSet.has(schedule.id)
              const isAvailable = schedule.isAvailable && !isBooked
              
              if (isBooked) {
                console.log(`⛔ [多人陪玩搜索] 時段 ${schedule.id} 已被預約（二次檢查）`)
              }
              
              return hasOverlap && isAvailable
            })
            .map(schedule => ({
              ...schedule,
              startTime: new Date(schedule.startTime),
              endTime: new Date(schedule.endTime),
            }))
          
          // Step 2: 按開始時間排序
          relevantSchedules.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
          
          // Step 3: 檢查是否能連續覆蓋搜索區間
          let coveredUntil = startDateTimeUTC.getTime()
          const searchEndTimestamp = endDateTimeUTC.getTime()
          const matchingSchedules: typeof relevantSchedules = []
          
          for (const schedule of relevantSchedules) {
            const scheduleStart = schedule.startTime.getTime()
            const scheduleEnd = schedule.endTime.getTime()
            
            // 如果有斷層（gap），無法連續覆蓋，失敗
            if (scheduleStart > coveredUntil) {
              const gapMinutes = Math.round((scheduleStart - coveredUntil) / 1000 / 60)
              console.log(`⛔ [多人陪玩搜索] 時段 ${schedule.id} 有斷層:`, {
                scheduleStartUTC: schedule.startTime.toISOString(),
                scheduleEndUTC: schedule.endTime.toISOString(),
                coveredUntilUTC: new Date(coveredUntil).toISOString(),
                gap: `${gapMinutes} 分鐘`,
              })
              break
            }
            
            // 延伸可覆蓋時間
            if (scheduleEnd > coveredUntil) {
              coveredUntil = scheduleEnd
              matchingSchedules.push(schedule)
              
              console.log(`✅ [多人陪玩搜索] 時段 ${schedule.id} 延伸覆蓋到:`, {
                scheduleStartUTC: schedule.startTime.toISOString(),
                scheduleEndUTC: schedule.endTime.toISOString(),
                coveredUntilUTC: new Date(coveredUntil).toISOString(),
                searchEndUTC: endDateTimeUTC.toISOString(),
              })
            }
            
            // 已完全覆蓋搜索區間
            if (coveredUntil >= searchEndTimestamp) {
              console.log(`🎯 [多人陪玩搜索] 夥伴 ${partner.name} 的 ${matchingSchedules.length} 個連續時段完全覆蓋搜索區間`)
              break
            }
          }
          
          const isFullyCovered = coveredUntil >= searchEndTimestamp
          
          if (debug) {
            const partnerDebug = debugInfo.partners.find((p: any) => p.partnerId === partner.id) || {
              partnerId: partner.id,
              partnerName: partner.name,
              scheduleChecks: [],
            }
            if (!debugInfo.partners.find((p: any) => p.partnerId === partner.id)) {
              debugInfo.partners.push(partnerDebug)
            }
            
            // 記錄所有相關時段的檢查結果
            relevantSchedules.forEach(schedule => {
              const isInMatchingSet = matchingSchedules.some(s => s.id === schedule.id)
              partnerDebug.scheduleChecks.push({
                scheduleId: schedule.id,
                scheduleStartUTC: schedule.startTime.toISOString(),
                scheduleEndUTC: schedule.endTime.toISOString(),
                searchStartUTC: startDateTimeUTC.toISOString(),
                searchEndUTC: endDateTimeUTC.toISOString(),
                isInMatchingSet,
                scheduleIsAvailable: schedule.isAvailable,
                hasActiveBooking: bookedScheduleIdSet.has(schedule.id),
                bookingStatus: bookedScheduleIdSet.has(schedule.id) ? 'BOOKED' : null,
                finalMatch: isInMatchingSet && isFullyCovered,
              })
            })
            
            if (!isFullyCovered) {
              partnerDebug.coverageInfo = {
                coveredUntilUTC: new Date(coveredUntil).toISOString(),
                searchEndUTC: endDateTimeUTC.toISOString(),
                gap: `${Math.round((searchEndTimestamp - coveredUntil) / 1000 / 60)} 分鐘`,
              }
            }
          }
          
          const matchingSchedule = isFullyCovered ? matchingSchedules[0] : null
          
          if (!matchingSchedule || !isFullyCovered) {
            console.log(`❌ [多人陪玩搜索] 夥伴 ${partner.name} (${partner.id}) 沒有符合條件的時段`, {
              reason: !isFullyCovered ? '時段無法連續覆蓋搜索區間' : '無可用時段',
              coveredUntil: new Date(coveredUntil).toISOString(),
              searchEnd: endDateTimeUTC.toISOString(),
              matchingSchedulesCount: matchingSchedules.length,
            })
            
            if (debug) {
              const partnerDebug = debugInfo.partners.find((p: any) => p.partnerId === partner.id)
              if (partnerDebug) {
                partnerDebug.finalStatus = !isFullyCovered 
                  ? `時段無法連續覆蓋（僅覆蓋到 ${new Date(coveredUntil).toISOString()}）`
                  : '沒有符合條件的時段'
              }
            }
            
            return null
          }
          
          console.log(`✅ [多人陪玩搜索] 夥伴 ${partner.name} (${partner.id}) 找到匹配時段組合:`, {
            schedulesCount: matchingSchedules.length,
            schedules: matchingSchedules.map(s => ({
              id: s.id,
              startTime: s.startTime.toISOString(),
              endTime: s.endTime.toISOString(),
            })),
            coveredRange: `${matchingSchedules[0].startTime.toISOString()} ~ ${new Date(coveredUntil).toISOString()}`,
          })
          
          if (debug) {
            const partnerDebug = debugInfo.partners.find((p: any) => p.partnerId === partner.id)
            if (partnerDebug) {
              partnerDebug.finalStatus = '匹配成功'
              partnerDebug.matchingSchedules = matchingSchedules.map(s => ({
                id: s.id,
                startTime: s.startTime.toISOString(),
                endTime: s.endTime.toISOString(),
              }))
              partnerDebug.coveredRange = {
                start: matchingSchedules[0].startTime.toISOString(),
                end: new Date(coveredUntil).toISOString(),
              }
            }
          }
          
          // 返回第一個 schedule 作為代表（實際預約時會使用所有匹配的 schedules）
          return {
            id: partner.id,
            name: partner.name,
            coverImage: partner.coverImage,
            images: partner.images || [],
            games: partner.games || [],
            halfHourlyRate: partner.halfHourlyRate,
            isAvailableNow: partner.isAvailableNow || false,
            isRankBooster: partner.isRankBooster || false,
            supportsChatOnly: partner.supportsChatOnly || false,
            chatOnlyRate: partner.chatOnlyRate || null,
            customerMessage: partner.customerMessage || null,
            averageRating: 0,
            totalReviews: 0,
            matchingSchedule: {
              id: matchingSchedules[0].id,
              startTime: matchingSchedules[0].startTime,
              endTime: new Date(coveredUntil), // 使用覆蓋的結束時間
            },
            // 包含所有匹配的 schedules（供後續預約使用）
            matchingSchedules: matchingSchedules.map(s => ({
              id: s.id,
              startTime: s.startTime,
              endTime: s.endTime,
            }))
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
          startDateTimeUTC: startDateTimeUTC.toISOString(),
          endDateTimeUTC: endDateTimeUTC.toISOString(),
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

