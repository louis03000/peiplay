import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { sendBookingNotificationEmail } from '@/lib/email'
import { BookingStatus } from '@prisma/client'
import { checkTimeConflict } from '@/lib/time-conflict'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 創建多人陪玩群組
 */
export async function POST(request: Request) {
  try {
    console.log('[multi-player-booking] ========== POST 請求開始 ==========')
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('[multi-player-booking] ❌ 未登入')
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    
    console.log('[multi-player-booking] ✅ 用戶已登入:', session.user.id)

    let body
    try {
      body = await request.json()
      console.log('[multi-player-booking] 📦 收到的 body:', JSON.stringify(body, null, 2))
    } catch (parseError: any) {
      console.error('[multi-player-booking] ❌ JSON 解析失敗:', {
        error: parseError,
        message: parseError?.message,
        stack: parseError?.stack,
      })
      return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
    }
    
    const { date, startTime, endTime, games, partnerScheduleIds } = body

    // 驗證必要參數
    if (!date || !startTime || !endTime) {
      console.log('[multi-player-booking] ❌ 缺少時間參數')
      return NextResponse.json({ error: '缺少必要參數：date, startTime, endTime' }, { status: 400 })
    }
    
    if (!Array.isArray(partnerScheduleIds)) {
      console.log('[multi-player-booking] ❌ partnerScheduleIds 不是陣列:', typeof partnerScheduleIds)
      return NextResponse.json({ error: 'partnerScheduleIds 必須是陣列' }, { status: 400 })
    }
    
    if (partnerScheduleIds.length === 0) {
      console.log('[multi-player-booking] ❌ partnerScheduleIds 為空陣列')
      return NextResponse.json({ error: '請至少選擇一位夥伴' }, { status: 400 })
    }
    
    console.log('[multi-player-booking] ✅ 參數驗證通過，夥伴數量:', partnerScheduleIds.length)

    // 統一日期格式（處理可能的 / 或 - 分隔符）
    const normalizedDate = date.replace(/\//g, '-')
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (!datePattern.test(normalizedDate)) {
      console.log('[multi-player-booking] ❌ 日期格式錯誤:', date)
      return NextResponse.json({ error: '日期格式錯誤，應為 YYYY-MM-DD' }, { status: 400 })
    }

    // 驗證時間格式
    const timePattern = /^\d{2}:\d{2}$/
    const startTimeStr = startTime.includes(':') ? startTime : `${startTime.slice(0, 2)}:${startTime.slice(2)}`
    const endTimeStr = endTime.includes(':') ? endTime : `${endTime.slice(0, 2)}:${endTime.slice(2)}`
    
    if (!timePattern.test(startTimeStr) || !timePattern.test(endTimeStr)) {
      console.log('[multi-player-booking] ❌ 時間格式錯誤:', { startTime, endTime })
      return NextResponse.json({ error: '時間格式錯誤，應為 HH:mm' }, { status: 400 })
    }

    // ⚠️ API 層：前端發送的是台灣時間字符串，需要轉換為 UTC 存儲
    // 但之後所有比較都用 UTC，不再轉換
    const dateTimeString = `${normalizedDate} ${startTimeStr}`
    
    // 🔥 處理跨日情況：如果結束時間小於開始時間，視為隔天
    let endDate = normalizedDate
    const [startHour, startMinute] = startTimeStr.split(':').map(Number)
    const [endHour, endMinute] = endTimeStr.split(':').map(Number)
    
    // 如果結束時間小於開始時間，則視為隔天
    if (endHour < startHour || (endHour === startHour && endMinute < startMinute)) {
      // 將結束日期加一天
      const endDateObj = dayjs.tz(`${normalizedDate} 00:00`, 'Asia/Taipei')
      endDate = endDateObj.add(1, 'day').format('YYYY-MM-DD')
      console.log('[multi-player-booking] 🔄 檢測到跨日時間段，結束日期調整為:', endDate)
    }
    
    const endDateTimeString = `${endDate} ${endTimeStr}`
    
    // 將台灣時間轉換為 UTC（僅此一次）
    const startDateTimeUTC = dayjs
      .tz(dateTimeString, 'Asia/Taipei')
      .utc()
      .toDate()
    
    const endDateTimeUTC = dayjs
      .tz(endDateTimeString, 'Asia/Taipei')
      .utc()
      .toDate()
    
    if (!startDateTimeUTC || !endDateTimeUTC || isNaN(startDateTimeUTC.getTime()) || isNaN(endDateTimeUTC.getTime())) {
      console.log('[multi-player-booking] ❌ 時間對象創建失敗:', { dateTimeString, endDateTimeString })
      return NextResponse.json({ error: '時間對象創建失敗' }, { status: 400 })
    }

    // ⚠️ 時間比較：使用 UTC，不再轉換
    const now = new Date() // UTC
    
    // 🔥 移除「必須預約兩小時後」的限制，允許立即預約
    
    // 🔥 修正跨日驗證：現在已經處理了跨日情況，所以這裡只需要確保結束時間大於開始時間
    if (endDateTimeUTC <= startDateTimeUTC) {
      console.log('[multi-player-booking] ❌ 結束時間必須晚於開始時間')
      return NextResponse.json({ error: '結束時間必須晚於開始時間' }, { status: 400 })
    }
    
    // 使用 UTC 時間（與資料庫存儲一致）
    const startDateTime = startDateTimeUTC
    const endDateTime = endDateTimeUTC
    
    console.log('[multi-player-booking] ✅ 時間驗證通過:', {
      input: { date: normalizedDate, startTime: startTimeStr, endTime: endTimeStr },
      taipeiView: {
        start: dayjs(startDateTime).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm'),
        end: dayjs(endDateTime).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm'),
      },
      utcView: {
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
      },
    })

    console.log('[multi-player-booking] 🔍 開始資料庫查詢...')
    
    const result = await db.query(async (client) => {
      // 查找客戶資料
      console.log('[multi-player-booking] 🔍 查詢客戶資料，userId:', session.user.id)
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          violationCount: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      })

      if (!customer) {
        console.log('[multi-player-booking] ❌ 客戶資料不存在')
        return { type: 'NO_CUSTOMER' } as const
      }
      
      console.log('[multi-player-booking] ✅ 客戶資料找到:', customer.id)

      // 檢查違規次數
      if (customer.violationCount >= 3) {
        console.log('[multi-player-booking] ❌ 帳號已被停權，違規次數:', customer.violationCount)
        return { type: 'SUSPENDED' } as const
      }
      
      console.log('[multi-player-booking] ✅ 違規次數檢查通過:', customer.violationCount)

      // 先驗證所有夥伴的時段並檢查時間衝突（在事務外）
      const partnerData: Array<{
        scheduleId: string
        partnerId: string
        partnerName: string
        partnerEmail: string
        amount: number
      }> = []

      let totalAmount = 0

      console.log('[multi-player-booking] 🔍 開始驗證', partnerScheduleIds.length, '個時段...')
      
      // 🔥 檢查是否有重複的 scheduleId
      const scheduleIdSet = new Set(partnerScheduleIds)
      if (scheduleIdSet.size !== partnerScheduleIds.length) {
        const duplicates = partnerScheduleIds.filter((id, index) => partnerScheduleIds.indexOf(id) !== index)
        console.error('[multi-player-booking] ❌ 檢測到重複的時段 ID:', duplicates)
        return { 
          type: 'DUPLICATE_SCHEDULE', 
          message: '不能選擇相同的時段，請選擇不同的時段' 
        } as const
      }
      
      for (let i = 0; i < partnerScheduleIds.length; i++) {
        const scheduleId = partnerScheduleIds[i]
        console.log(`[multi-player-booking] 🔍 [${i + 1}/${partnerScheduleIds.length}] 驗證時段:`, scheduleId)
        
        const schedule = await client.schedule.findUnique({
          where: { id: scheduleId },
          include: {
            partner: {
              include: {
                user: {
                  select: {
                    email: true,
                    name: true,
                  },
                },
              },
            },
            bookings: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        })

        // 驗證時段並返回錯誤類型（不 throw）
        if (!schedule) {
          console.error(`[multi-player-booking] ❌ 時段不存在:`, scheduleId)
          return { type: 'INVALID_SCHEDULE', message: `時段 ${scheduleId} 不存在` } as const
        }
        
        console.log(`[multi-player-booking] ✅ 時段找到，夥伴:`, schedule.partner.user.name)

        // 檢查時段是否可用
        if (!schedule.isAvailable) {
          return { 
            type: 'SCHEDULE_UNAVAILABLE', 
            message: `夥伴 ${schedule.partner.user.name} 的時段不可用` 
          } as const
        }

        // 檢查時段是否已被預約
        // 注意：根據 schema，bookings 是 Booking?（單一關聯），但為了安全，我們也檢查陣列情況
        const hasActiveBooking = Array.isArray(schedule.bookings)
          ? schedule.bookings.some(
              (b: any) => b.status !== 'CANCELLED' && b.status !== 'REJECTED'
            )
          : schedule.bookings && 
            schedule.bookings.status !== 'CANCELLED' && 
            schedule.bookings.status !== 'REJECTED'
        
        if (hasActiveBooking) {
          return { 
            type: 'ALREADY_BOOKED', 
            message: `夥伴 ${schedule.partner.user.name} 的時段已被預約` 
          } as const
        }

        // 檢查時段是否完全匹配（考慮時區）
        // schedule.startTime 和 schedule.endTime 是 UTC 時間（從資料庫）
        const scheduleStart = schedule.startTime instanceof Date ? schedule.startTime : new Date(schedule.startTime)
        const scheduleEnd = schedule.endTime instanceof Date ? schedule.endTime : new Date(schedule.endTime)
        
        // 允許 1 分鐘的誤差（避免浮點數精度問題）
        const timeDiffStart = Math.abs(scheduleStart.getTime() - startDateTime.getTime())
        const timeDiffEnd = Math.abs(scheduleEnd.getTime() - endDateTime.getTime())
        const tolerance = 60 * 1000 // 1 分鐘
        
        // ⚠️ 時間比較：只使用 UTC，不轉換時區
        console.log(`[multi-player-booking] 🔍 時段匹配檢查 (${schedule.partner.user.name}) - UTC:`, {
          scheduleStart: scheduleStart.toISOString(),
          requestStart: startDateTime.toISOString(),
          timeDiffStart: timeDiffStart,
          scheduleEnd: scheduleEnd.toISOString(),
          requestEnd: endDateTime.toISOString(),
          timeDiffEnd: timeDiffEnd,
        })
        
        if (timeDiffStart > tolerance || timeDiffEnd > tolerance) {
          return { 
            type: 'SCHEDULE_MISMATCH', 
            message: `夥伴 ${schedule.partner.user.name} 的時段不匹配。時段時間：${scheduleStart.toISOString()} - ${scheduleEnd.toISOString()}，請求時間：${startDateTime.toISOString()} - ${endDateTime.toISOString()}` 
          } as const
        }

        // 檢查時間衝突（在事務外）
        try {
          const conflictStartTime = schedule.startTime instanceof Date ? schedule.startTime : new Date(schedule.startTime)
          const conflictEndTime = schedule.endTime instanceof Date ? schedule.endTime : new Date(schedule.endTime)
          const conflict = await checkTimeConflict(
            schedule.partnerId,
            conflictStartTime,
            conflictEndTime,
            undefined,
            client
          )

          if (conflict.hasConflict) {
            return { 
              type: 'TIME_CONFLICT', 
              message: `夥伴 ${schedule.partner.user.name} 的時間有衝突` 
            } as const
          }
        } catch (conflictError: any) {
          // 如果錯誤訊息已經包含"時間衝突"，返回錯誤類型
          if (conflictError?.message?.includes('時間有衝突') || conflictError?.message?.includes('時間衝突')) {
            return { 
              type: 'TIME_CONFLICT', 
              message: conflictError.message 
            } as const
          }
          // 其他錯誤記錄詳細資訊並返回
          console.error(`[multi-player-booking] ❌ 檢查時間衝突失敗 (scheduleId: ${scheduleId}):`, {
            error: conflictError,
            message: conflictError?.message,
            stack: conflictError?.stack,
          })
          return { 
            type: 'TIME_CONFLICT_CHECK_FAILED', 
            message: `檢查時間衝突失敗: ${conflictError?.message || '未知錯誤'}` 
          } as const
        }

        // 計算費用
        const scheduleStartTime = schedule.startTime instanceof Date ? schedule.startTime : new Date(schedule.startTime)
        const scheduleEndTime = schedule.endTime instanceof Date ? schedule.endTime : new Date(schedule.endTime)
        const durationHours = (scheduleEndTime.getTime() - scheduleStartTime.getTime()) / (1000 * 60 * 60)
        const amount = durationHours * schedule.partner.halfHourlyRate * 2
        totalAmount += amount

        partnerData.push({
          scheduleId: schedule.id,
          partnerId: schedule.partnerId,
          partnerName: schedule.partner.user.name || '夥伴',
          partnerEmail: schedule.partner.user.email,
          amount,
        })
      }

      console.log('[multi-player-booking] 🔍 準備開始事務，夥伴數據:', partnerData.length, '筆')
      
      return await client.$transaction(async (tx) => {
        console.log('[multi-player-booking] ✅ 事務開始')
        console.log('[multi-player-booking] 📊 事務數據:', {
          customerId: customer.id,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          games: Array.isArray(games) ? games : [],
          totalAmount,
          partnerCount: partnerData.length,
        })

        // 創建多人陪玩群組
        let multiPlayerBooking
        try {
          multiPlayerBooking = await tx.multiPlayerBooking.create({
            data: {
              customerId: customer.id,
              date: startDateTime,
              startTime: startDateTime,
              endTime: endDateTime,
              games: Array.isArray(games) ? games : [],
              status: 'PENDING',
              totalAmount,
            },
          })
          console.log('[multi-player-booking] ✅ 多人陪玩群組創建成功:', multiPlayerBooking.id)
        } catch (createError: any) {
          console.error('[multi-player-booking] ❌ 創建多人陪玩群組失敗:', {
            code: createError?.code,
            message: createError?.message,
            meta: createError?.meta,
            stack: createError?.stack,
          })
          throw createError
        }

        // 為每個夥伴創建 booking
        const bookingRecords: Array<{
          bookingId: string
          partnerEmail: string
          partnerName: string
          amount: number
        }> = []

        for (const partner of partnerData) {
          try {
            console.log(`[multi-player-booking] 📝 為夥伴 ${partner.partnerName} 創建預約...`)
            
            // 🔥 在事務中再次檢查時段是否已被預約（防止並發問題）
            const scheduleInTx = await tx.schedule.findUnique({
              where: { id: partner.scheduleId },
              include: {
                bookings: {
                  where: {
                    status: {
                      notIn: ['CANCELLED', 'REJECTED']
                    }
                  },
                  select: {
                    id: true,
                    status: true,
                  },
                },
              },
            })
            
            if (!scheduleInTx) {
              throw new Error(`時段 ${partner.scheduleId} 不存在`)
            }
            
            // 檢查時段是否已被預約（包括當前事務中已創建的 Booking）
            const hasActiveBooking = Array.isArray(scheduleInTx.bookings)
              ? scheduleInTx.bookings.length > 0
              : scheduleInTx.bookings !== null
            
            if (hasActiveBooking) {
              throw new Error(`夥伴 ${partner.partnerName} 的時段已被預約，請選擇其他時段`)
            }
            
            const booking = await tx.booking.create({
              data: {
                customerId: customer.id,
                partnerId: partner.partnerId,
                scheduleId: partner.scheduleId,
                status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
                originalAmount: partner.amount,
                finalAmount: partner.amount,
                isMultiPlayerBooking: true,
                multiPlayerBookingId: multiPlayerBooking.id,
                paymentInfo: {
                  isInstantBooking: false,
                  isMultiPlayerBooking: true,
                },
              },
            })
            console.log(`[multi-player-booking] ✅ 預約創建成功: ${booking.id}`)

            bookingRecords.push({
              bookingId: booking.id,
              partnerEmail: partner.partnerEmail,
              partnerName: partner.partnerName,
              amount: partner.amount,
            })
          } catch (createError: any) {
            console.error(`[multi-player-booking] ❌ 創建預約失敗 (時段: ${partner.scheduleId}):`, {
              code: createError?.code,
              message: createError?.message,
              meta: createError?.meta,
              stack: createError?.stack,
            })
            
            // 處理 Prisma 特定錯誤
            if (createError?.code === 'P2002') {
              const target = createError?.meta?.target as string[] || []
              if (target.includes('scheduleId')) {
                throw new Error(`夥伴 ${partner.partnerName} 的時段已被預約，請選擇其他時段`)
              }
              throw new Error(`資料衝突: ${target.join(', ')}`)
            }
            
            if (createError?.code === 'P2003') {
              throw new Error(`關聯資料錯誤: ${createError?.message}`)
            }
            
            if (createError?.code === 'P2036') {
              throw new Error(`資料庫欄位不存在: ${createError?.message}`)
            }
            
            if (createError?.code === 'P2022') {
              throw new Error(`資料值不符合欄位類型: ${createError?.message || '請檢查資料格式'}`)
            }
            
            if (createError?.code === 'P2024' || createError?.code === 'P1008' || createError?.code === 'P1017') {
              throw new Error(`資料庫操作超時，請稍後再試`)
            }
            
            throw createError
          }
        }

        console.log('[multi-player-booking] ✅ 事務完成，共創建', bookingRecords.length, '個預約')
        return {
          type: 'SUCCESS' as const,
          multiPlayerBooking,
          bookings: bookingRecords,
          customer,
        }
      }, {
        maxWait: 10000,
        timeout: 20000,
      })
    }, 'multi-player-booking:create')
    
    console.log('[multi-player-booking] 🔍 事務結果:', result)
    
    if (!result) {
      console.error('[multi-player-booking] ❌ 事務結果為空')
      return NextResponse.json({ error: '創建預約失敗，請稍後再試' }, { status: 500 })
    }
    
    console.log('[multi-player-booking] 🔍 事務結果類型:', result.type)

    if (result.type === 'NO_CUSTOMER') {
      console.log('[multi-player-booking] ❌ 客戶資料不存在')
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
    }

    if (result.type === 'SUSPENDED') {
      console.log('[multi-player-booking] ❌ 帳號已被停權')
      return NextResponse.json({ error: '您的帳號已被停權，無法創建預約' }, { status: 403 })
    }
    
    // 處理驗證錯誤（400 狀態碼）
    if (result.type === 'INVALID_SCHEDULE') {
      console.log('[multi-player-booking] ❌', result.message)
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
    
    if (result.type === 'SCHEDULE_UNAVAILABLE') {
      console.log('[multi-player-booking] ❌', result.message)
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
    
    if (result.type === 'ALREADY_BOOKED') {
      console.log('[multi-player-booking] ❌', result.message)
      return NextResponse.json({ error: result.message }, { status: 409 })
    }
    
    if (result.type === 'SCHEDULE_MISMATCH') {
      console.log('[multi-player-booking] ❌', result.message)
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
    
    if (result.type === 'TIME_CONFLICT') {
      console.log('[multi-player-booking] ❌', result.message)
      return NextResponse.json({ error: result.message }, { status: 409 })
    }
    
    if (result.type === 'TIME_CONFLICT_CHECK_FAILED') {
      console.log('[multi-player-booking] ❌', result.message)
      return NextResponse.json({ error: result.message }, { status: 500 })
    }
    
    if (result.type === 'DUPLICATE_SCHEDULE') {
      console.log('[multi-player-booking] ❌', result.message)
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
    
    if (result.type !== 'SUCCESS') {
      console.error('[multi-player-booking] ❌ 未知的結果類型:', result)
      return NextResponse.json({ error: '創建預約失敗，請稍後再試' }, { status: 500 })
    }
    
    console.log('✅ 多人陪玩群組創建成功，ID:', result.multiPlayerBooking.id)

    // 發送通知（非阻塞）
    console.log(`[multi-player-booking] 📧 準備發送 ${result.bookings.length} 封預約通知郵件`)
    for (const booking of result.bookings) {
      console.log(`[multi-player-booking] 📧 發送預約通知給夥伴: ${booking.partnerName} (${booking.partnerEmail})`)
      sendBookingNotificationEmail(
        booking.partnerEmail,
        booking.partnerName,
        result.customer.user.name || '客戶',
        {
          bookingId: booking.bookingId,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          duration: (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60),
          totalCost: booking.amount,
          customerName: result.customer.user.name || '客戶',
          customerEmail: result.customer.user.email,
        }
      )
        .then(() => {
          console.log(`[multi-player-booking] ✅ 預約通知郵件已發送給夥伴: ${booking.partnerName} (${booking.partnerEmail})`)
        })
        .catch((error) => {
          console.error(`[multi-player-booking] ❌ Email 發送失敗給夥伴 ${booking.partnerName} (${booking.partnerEmail}):`, error)
        })
    }

    return NextResponse.json({
      success: true,
      multiPlayerBooking: {
        id: result.multiPlayerBooking.id,
        status: result.multiPlayerBooking.status,
        totalAmount: result.multiPlayerBooking.totalAmount,
        startTime: result.multiPlayerBooking.startTime.toISOString(),
        endTime: result.multiPlayerBooking.endTime.toISOString(),
      },
      bookings: result.bookings.map(b => ({
        id: b.bookingId,
        status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
        amount: b.amount,
      })),
    })
  } catch (error: any) {
    console.error('[multi-player-booking] ========== ❌ 未捕捉的錯誤 ==========')
    console.error('[multi-player-booking] ❌ 錯誤類型:', typeof error)
    console.error('[multi-player-booking] ❌ 錯誤值:', error)
    
    // 記錄詳細錯誤資訊
    if (error instanceof Error) {
      console.error('[multi-player-booking] ❌ Error 物件詳情:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      })
    } else if (error && typeof error === 'object') {
      console.error('[multi-player-booking] ❌ 錯誤物件:', {
        code: error?.code,
        message: error?.message,
        meta: error?.meta,
        stack: error?.stack,
        name: error?.name,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      })
    } else {
      console.error('[multi-player-booking] ❌ 非 Error 類型的錯誤:', String(error))
    }
    
    // 確保返回 JSON 響應，避免未定義的 response
    try {
      const errorResponse = createErrorResponse(error, 'multi-player-booking:create')
      console.log('[multi-player-booking] ✅ 錯誤響應已創建')
      return errorResponse
    } catch (responseError: any) {
      console.error('[multi-player-booking] ❌ 創建錯誤響應失敗:', {
        error: responseError,
        message: responseError?.message,
        stack: responseError?.stack,
      })
      return NextResponse.json(
        { 
          error: '伺服器內部錯誤，請稍後再試',
          details: process.env.NODE_ENV === 'development' 
            ? (error instanceof Error ? error.message : String(error)) 
            : undefined
        },
        { status: 500 }
      )
    }
  }
}

/**
 * 獲取用戶的多人陪玩群組列表
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })

      if (!customer) {
        return null
      }

      try {
        return await client.multiPlayerBooking.findMany({
          where: { customerId: customer.id },
          include: {
            bookings: {
              include: {
                schedule: {
                  include: {
                    partner: {
                      include: {
                        user: {
                          select: {
                            name: true,
                            email: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      } catch (dbError: any) {
        const errorMessage = dbError?.message || ''
        const errorCode = dbError?.code || ''
        
        if (errorMessage.includes('does not exist') || 
            errorMessage.includes('table') ||
            errorMessage.includes('MultiPlayerBooking') ||
            errorCode === 'P2021' ||
            errorCode === 'P1001') {
          return []
        }
        throw dbError
      }
    }, 'multi-player-booking:list')

    if (result === null) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
    }

    return NextResponse.json({ multiPlayerBookings: result })
  } catch (error) {
    console.error('獲取多人陪玩群組列表失敗:', error)
    return createErrorResponse(error, 'multi-player-booking:list')
  }
}





