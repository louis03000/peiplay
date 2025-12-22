import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { sendBookingNotificationEmail } from '@/lib/email'
import { BookingStatus } from '@prisma/client'
import { checkTimeConflict } from '@/lib/time-conflict'

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

    // 檢查時段是否在「現在+2小時」之後
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    
    const startTimeStr = startTime.includes(':') ? startTime : `${startTime.slice(0, 2)}:${startTime.slice(2)}`
    const endTimeStr = endTime.includes(':') ? endTime : `${endTime.slice(0, 2)}:${endTime.slice(2)}`
    
    const selectedStartTime = new Date(`${date}T${startTimeStr}:00`)
    
    if (isNaN(selectedStartTime.getTime())) {
      return NextResponse.json({ error: '開始時間格式錯誤' }, { status: 400 })
    }
    
    if (selectedStartTime <= twoHoursLater) {
      return NextResponse.json({ 
        error: '預約時段必須在現在時間的2小時之後'
      }, { status: 400 })
    }

    const startDateTime = new Date(`${date}T${startTimeStr}:00`)
    const endDateTime = new Date(`${date}T${endTimeStr}:00`)
    
    if (isNaN(startDateTime.getTime())) {
      console.log('[multi-player-booking] ❌ 開始時間格式錯誤:', `${date}T${startTimeStr}:00`)
      return NextResponse.json({ error: '開始時間格式錯誤' }, { status: 400 })
    }
    
    if (isNaN(endDateTime.getTime())) {
      console.log('[multi-player-booking] ❌ 結束時間格式錯誤:', `${date}T${endTimeStr}:00`)
      return NextResponse.json({ error: '結束時間格式錯誤' }, { status: 400 })
    }

    if (endDateTime <= startDateTime) {
      console.log('[multi-player-booking] ❌ 結束時間必須晚於開始時間')
      return NextResponse.json({ error: '結束時間必須晚於開始時間' }, { status: 400 })
    }
    
    console.log('[multi-player-booking] ✅ 時間驗證通過:', {
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
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

        if (!schedule) {
          console.error(`[multi-player-booking] ❌ 時段不存在:`, scheduleId)
          throw new Error(`時段 ${scheduleId} 不存在`)
        }
        
        console.log(`[multi-player-booking] ✅ 時段找到，夥伴:`, schedule.partner.user.name)

        // 檢查時段是否可用
        if (!schedule.isAvailable) {
          throw new Error(`夥伴 ${schedule.partner.user.name} 的時段不可用`)
        }

        // 檢查時段是否已被預約（bookings 是單一關聯，不是陣列）
        if (schedule.bookings && schedule.bookings.status !== 'CANCELLED' && schedule.bookings.status !== 'REJECTED') {
          throw new Error(`夥伴 ${schedule.partner.user.name} 的時段已被預約`)
        }

        // 檢查時段是否完全匹配
        const scheduleStart = new Date(schedule.startTime)
        const scheduleEnd = new Date(schedule.endTime)
        
        if (scheduleStart.getTime() !== startDateTime.getTime() || 
            scheduleEnd.getTime() !== endDateTime.getTime()) {
          throw new Error(`夥伴 ${schedule.partner.user.name} 的時段不匹配`)
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
            throw new Error(`夥伴 ${schedule.partner.user.name} 的時間有衝突`)
          }
        } catch (conflictError: any) {
          // 如果錯誤訊息已經包含"時間衝突"，直接拋出
          if (conflictError?.message?.includes('時間有衝突') || conflictError?.message?.includes('時間衝突')) {
            throw conflictError
          }
          // 其他錯誤記錄詳細資訊
          console.error(`❌ 檢查時間衝突失敗 (scheduleId: ${scheduleId}):`, {
            error: conflictError,
            message: conflictError?.message,
            stack: conflictError?.stack,
          })
          throw new Error(`檢查時間衝突失敗: ${conflictError?.message || '未知錯誤'}`)
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
      console.log('❌ 客戶資料不存在')
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
    }

    if (result.type === 'SUSPENDED') {
      console.log('❌ 帳號已被停權')
      return NextResponse.json({ error: '您的帳號已被停權，無法創建預約' }, { status: 403 })
    }
    
    if (result.type !== 'SUCCESS') {
      console.error('❌ 未知的結果類型:', result)
      return NextResponse.json({ error: '創建預約失敗，請稍後再試' }, { status: 500 })
    }
    
    console.log('✅ 多人陪玩群組創建成功，ID:', result.multiPlayerBooking.id)

    // 發送通知（非阻塞）
    for (const booking of result.bookings) {
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
      ).catch((error) => {
        console.error('Email 發送失敗:', error)
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





