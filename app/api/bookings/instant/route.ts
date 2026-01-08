import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // ⚠️ 必須是 nodejs，Prisma/PostgreSQL/transaction 都需要

export async function POST(request: NextRequest) {
  // 🔥 保證會執行的日誌（在 try-catch 之前，確保即使早期錯誤也能看到）
  console.log('🔥 instant booking API ENTERED')
  console.log('🔥 Request received at:', new Date().toISOString())
  console.log('🔥 Request URL:', request.url)
  console.log('🔥 Request Method:', request.method)
  
  // 🔥 立即生成 requestId，確保即使早期錯誤也能追蹤
  const requestStartTime = Date.now()
  const requestId = request.headers.get('x-request-id') || `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  console.log('🔥 Request ID:', requestId)
  
  let requestData: any
  try {
    console.log(`[${requestId}] 📦 開始解析請求 body...`)
    requestData = await request.json()
    console.log(`[${requestId}] 📦 請求 body 解析成功:`, JSON.stringify(requestData))
  } catch (error) {
    console.error(`[${requestId}] ❌ req.json failed:`, error)
    console.error(`[${requestId}] 錯誤詳情:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    return NextResponse.json({ 
      error: '無效的請求數據',
      code: 'INVALID_JSON',
      requestId 
    }, { status: 400 })
  }

  try {
    // 🔥 動態導入所有可能有問題的模組
    console.log(`[${requestId}] 📦 開始動態導入模組...`)
    const { getServerSession } = await import('next-auth/next')
    const { authOptions } = await import('@/lib/auth')
    const { db } = await import('@/lib/db-resilience')
    const { BookingStatus } = await import('@prisma/client')
    console.log(`[${requestId}] ✅ 模組導入成功`)
    
    // 🔥 強制 log 所有關鍵步驟
    console.log(`[${requestId}] 📥 收到即時預約請求:`, { 
      partnerId: requestData?.partnerId, 
      duration: requestData?.duration,
      bodyKeys: Object.keys(requestData || {}),
      headers: {
        contentType: request.headers.get('content-type'),
        userAgent: request.headers.get('user-agent'),
      }
    })
    
    // 🔥 包裹 getServerSession，防止它拋出未捕獲的錯誤
    let session
    try {
      console.log(`[${requestId}] 🔐 開始獲取 session...`)
      session = await getServerSession(authOptions)
      console.log(`[${requestId}] 🔐 Session 狀態:`, { 
        hasSession: !!session, 
        hasUser: !!session?.user, 
        userId: session?.user?.id,
        sessionKeys: session ? Object.keys(session) : []
      })
    } catch (sessionError) {
      console.error(`[${requestId}] ❌ 獲取 session 失敗:`, sessionError)
      console.error(`[${requestId}] Session 錯誤詳情:`, {
        message: sessionError instanceof Error ? sessionError.message : 'Unknown error',
        stack: sessionError instanceof Error ? sessionError.stack : undefined,
        name: sessionError instanceof Error ? sessionError.name : undefined,
      })
      return NextResponse.json(
        { 
          error: 'Session 驗證失敗，請重新登入',
          code: 'SESSION_ERROR',
          details: process.env.NODE_ENV === 'development' 
            ? (sessionError instanceof Error ? sessionError.message : 'Unknown error')
            : undefined
        },
        { status: 500 }
      )
    }
    
    if (!session?.user?.id) {
      console.error(`[${requestId}] ❌ 未登入或 session 無效`, { session })
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { partnerId, duration, isChatOnly } = requestData

    // 驗證參數
    if (!partnerId || typeof partnerId !== 'string') {
      console.log(`[${requestId}] ❌ 參數驗證失敗: partnerId 無效`, { partnerId, type: typeof partnerId })
      return NextResponse.json({ error: '缺少或無效的夥伴ID' }, { status: 400 })
    }

    // 確保 duration 是數字類型
    const durationNum = typeof duration === 'string' ? parseFloat(duration) : Number(duration)
    if (!durationNum || isNaN(durationNum) || durationNum <= 0) {
      console.log(`[${requestId}] ❌ 參數驗證失敗: duration 無效`, { duration, durationNum, type: typeof duration })
      return NextResponse.json({ error: '缺少或無效的預約時長' }, { status: 400 })
    }

    // 確保 isChatOnly 是布林值
    const chatOnly = isChatOnly === true || isChatOnly === 'true'

    console.log(`[${requestId}] 🔍 開始執行資料庫查詢...`)
    let result
    try {
      // 🔥 延遲加載可能有問題的模組
      const { checkPartnerCurrentlyBusy, checkTimeConflict } = await import('@/lib/time-conflict')
      
      result = await db.query(async (client) => {
        try {
          console.log(`[${requestId}] 🔍 開始查詢客戶資料...`, { userId: session.user.id })
          const customer = await client.customer.findUnique({
            where: { userId: session.user.id },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          })

          if (!customer) {
            console.error(`[${requestId}] ❌ 客戶資料不存在`, { userId: session.user.id })
            return { type: 'NO_CUSTOMER' } as const
          }
          console.log(`[${requestId}] ✅ 客戶資料查詢成功:`, { customerId: customer.id, customerName: customer.user?.name })

          console.log(`[${requestId}] 🔍 開始查詢夥伴資料...`, { partnerId })
          const partner = await client.partner.findUnique({
            where: { id: partnerId },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          })

          if (!partner) {
            console.error(`[${requestId}] ❌ 夥伴不存在`, { partnerId })
            return { type: 'NO_PARTNER' } as const
          }
          console.log(`[${requestId}] ✅ 夥伴資料查詢成功:`, { partnerId: partner.id, partnerName: partner.name })

          console.log(`[${requestId}] 🔍 檢查夥伴是否忙碌...`, { partnerId: partner.id })
          let busyCheck
          try {
            busyCheck = await checkPartnerCurrentlyBusy(partner.id, client)
            console.log(`[${requestId}] ✅ 忙碌檢查完成:`, { isBusy: busyCheck.isBusy })
          } catch (error) {
            console.error(`[${requestId}] ❌ 檢查夥伴忙碌狀態失敗:`, error)
            console.error(`[${requestId}] 錯誤詳情:`, {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined,
            })
            throw new Error(`檢查夥伴忙碌狀態失敗: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
          if (busyCheck.isBusy) {
            console.error(`[${requestId}] ❌ 夥伴目前忙碌:`, busyCheck)
            return { type: 'BUSY', busyCheck } as const
          }

          // ⚠️ API 層：使用 UTC 時間，不做時區轉換
          // 當前時間 + 15 分鐘後開始（UTC）
          const now = new Date() // UTC
          const startTime = new Date(now.getTime() + 15 * 60 * 1000) // UTC + 15分鐘
          const endTime = new Date(startTime.getTime() + durationNum * 60 * 60 * 1000) // UTC + durationNum小時

          console.log(`[${requestId}] 🔍 檢查時間衝突...`, { 
            partnerId: partner.id, 
            startTime: startTime.toISOString(), 
            endTime: endTime.toISOString(),
            duration: durationNum,
            now: now.toISOString()
          })
          let conflict
          try {
            conflict = await checkTimeConflict(partner.id, startTime, endTime, undefined, client)
            console.log(`[${requestId}] ✅ 時間衝突檢查完成:`, { hasConflict: conflict.hasConflict, conflictsCount: conflict.conflicts.length })
          } catch (error) {
            console.error(`[${requestId}] ❌ 檢查時間衝突失敗:`, error)
            console.error(`[${requestId}] 錯誤詳情:`, {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined,
            })
            throw new Error(`檢查時間衝突失敗: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
          if (conflict.hasConflict) {
            console.error(`[${requestId}] ❌ 時間衝突:`, conflict)
            return { type: 'CONFLICT', conflict } as const
          }

          // 🔥 計算價格：如果是純聊天，使用 chatOnlyRate；否則使用 halfHourlyRate
          let originalAmount: number
          if (chatOnly && partner.chatOnlyRate) {
            // 純聊天價格 = chatOnlyRate * (實際分鐘數 / 30分鐘)
            // durationNum 是以小時為單位，所以實際分鐘數 = durationNum * 60
            const durationMinutes = durationNum * 60
            originalAmount = partner.chatOnlyRate * (durationMinutes / 30)
            console.log(`[${requestId}] 💰 純聊天價格計算:`, {
              chatOnlyRate: partner.chatOnlyRate,
              durationHours: durationNum,
              durationMinutes,
              originalAmount,
            })
          } else {
            // 一般預約價格 = halfHourlyRate * durationNum * 2
            originalAmount = durationNum * partner.halfHourlyRate * 2
            console.log(`[${requestId}] 💰 一般預約價格計算:`, {
              halfHourlyRate: partner.halfHourlyRate,
              durationHours: durationNum,
              originalAmount,
            })
          }

          const pricing = {
            duration: durationNum,
            originalAmount,
          }

          console.log(`[${requestId}] 🔍 開始創建預約（事務）...`, {
            partnerId: partner.id,
            customerId: customer.id,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: durationNum,
            amount: pricing.originalAmount
          })
          let schedule, booking
          try {
            const transactionResult = await client.$transaction(
              async (tx) => {
                console.log(`[${requestId}] 📝 創建時段...`, {
                  partnerId: partner.id,
                  date: startTime.toISOString(),
                  startTime: startTime.toISOString(),
                  endTime: endTime.toISOString(),
                })
                const createdSchedule = await tx.schedule.create({
                  data: {
                    partnerId: partner.id,
                    date: startTime,
                    startTime,
                    endTime,
                    isAvailable: false,
                  },
                })
                console.log(`[${requestId}] ✅ 時段創建成功:`, { scheduleId: createdSchedule.id })

                console.log(`[${requestId}] 📝 創建預約...`, {
                  customerId: customer.id,
                  partnerId: partner.id,
                  scheduleId: createdSchedule.id,
                  amount: pricing.originalAmount,
                })
                const createdBooking = await tx.booking.create({
                  data: {
                    customerId: customer.id,
                    partnerId: partner.id,
                    scheduleId: createdSchedule.id,
                    status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
                    originalAmount: pricing.originalAmount,
                    finalAmount: pricing.originalAmount,
                    serviceType: chatOnly ? 'CHAT_ONLY' : undefined, // 設置服務類型
                    paymentInfo: {
                      isInstantBooking: true,
                      isChatOnly: chatOnly, // 保存純聊天標誌
                    },
                  },
                })
                console.log(`[${requestId}] ✅ 預約創建成功:`, { bookingId: createdBooking.id })

                return { schedule: createdSchedule, booking: createdBooking }
              },
              {
                maxWait: 10000, // 等待事務開始的最大時間（10秒）
                timeout: 20000, // 事務執行的最大時間（20秒）
              }
            )
            schedule = transactionResult.schedule
            booking = transactionResult.booking
          } catch (transactionError) {
            console.error(`[${requestId}] ❌ 事務執行失敗:`, transactionError)
            console.error(`[${requestId}] 事務錯誤詳情:`, {
              message: transactionError instanceof Error ? transactionError.message : 'Unknown error',
              stack: transactionError instanceof Error ? transactionError.stack : undefined,
              name: transactionError instanceof Error ? transactionError.name : undefined,
              code: (transactionError as any)?.code,
              meta: (transactionError as any)?.meta,
            })
            throw new Error(`創建預約事務失敗: ${transactionError instanceof Error ? transactionError.message : 'Unknown error'}`)
          }

          console.log(`[${requestId}] ✅ 預約創建成功`)
          return { type: 'SUCCESS', customer, partner, schedule, booking, pricing, startTime, endTime } as const
        } catch (dbError) {
          console.error(`[${requestId}] ❌ 資料庫操作錯誤:`, dbError)
          console.error(`[${requestId}] 錯誤詳情:`, {
            message: dbError instanceof Error ? dbError.message : 'Unknown error',
            stack: dbError instanceof Error ? dbError.stack : undefined,
            name: dbError instanceof Error ? dbError.name : undefined,
            code: (dbError as any)?.code,
            meta: (dbError as any)?.meta,
          })
          throw dbError
        }
      }, 'bookings:instant')
      console.log(`[${requestId}] ✅ 資料庫查詢完成:`, { resultType: result.type })
    } catch (dbQueryError) {
      console.error(`[${requestId}] ❌ db.query 調用失敗:`, dbQueryError)
      console.error(`[${requestId}] db.query 錯誤詳情:`, {
        message: dbQueryError instanceof Error ? dbQueryError.message : 'Unknown error',
        stack: dbQueryError instanceof Error ? dbQueryError.stack : undefined,
        name: dbQueryError instanceof Error ? dbQueryError.name : undefined,
        code: (dbQueryError as any)?.code,
        meta: (dbQueryError as any)?.meta,
      })
      // 重新拋出錯誤，讓外層 catch 處理
      throw dbQueryError
    }

    if (result.type === 'NO_CUSTOMER') {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
    }

    if (result.type === 'NO_PARTNER') {
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 })
    }

    if (result.type === 'BUSY') {
      return NextResponse.json(
        {
          error: `夥伴目前正在服務中，預計 ${result.busyCheck.remainingMinutes} 分鐘後完成。請稍後再試。`,
          busyUntil: result.busyCheck.endTime,
          remainingMinutes: result.busyCheck.remainingMinutes,
        },
        { status: 409 }
      )
    }

    if (result.type === 'CONFLICT') {
      const conflictTimes = result.conflict.conflicts
        .map((c) => `${new Date(c.startTime).toLocaleString('zh-TW')} - ${new Date(c.endTime).toLocaleString('zh-TW')}`)
        .join(', ')

      return NextResponse.json(
        {
          error: `時間衝突！該夥伴在以下時段已有預約：${conflictTimes}`,
          conflicts: result.conflict.conflicts,
        },
        { status: 409 }
      )
    }

    // 非阻塞寄信（延遲加載）
    const { sendBookingNotificationEmail } = await import('@/lib/email')
    sendBookingNotificationEmail(
      result.partner.user.email,
      result.partner.user.name || result.partner.name || '夥伴',
      result.customer.user.name || '客戶',
      {
        bookingId: result.booking.id,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        duration: result.pricing.duration,
        totalCost: result.pricing.originalAmount,
        customerName: result.customer.user.name || '客戶',
        customerEmail: result.customer.user.email,
      }
    ).catch((error) => {
      console.error(`[${requestId}] ❌ Email 發送失敗:`, error)
    })

    return NextResponse.json({
      id: result.booking.id,
      message: '預約創建成功，已通知夥伴確認',
      totalCost: result.pricing.originalAmount,
      booking: {
        id: result.booking.id,
        status: result.booking.status,
        orderNumber: `INST-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        duration: result.pricing.duration,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        totalCost: result.pricing.originalAmount,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorName = error instanceof Error ? error.name : undefined
    const errorCode = (error as any)?.code
    const errorMeta = (error as any)?.meta
    
    // 🔥 強制 log 所有錯誤（這是關鍵！）
    console.error(`[${requestId}] ❌ 即時預約創建失敗:`)
    console.error(`[${requestId}] 錯誤對象:`, error)
    console.error(`[${requestId}] 錯誤詳情:`, {
      message: errorMessage,
      stack: errorStack,
      name: errorName,
      code: errorCode,
      meta: errorMeta,
      requestData: requestData ? { 
        partnerId: requestData.partnerId, 
        duration: requestData.duration,
        bodyKeys: Object.keys(requestData)
      } : undefined,
      requestTime: Date.now() - requestStartTime,
    })
    
    // 檢查是否是資料庫相關錯誤
    const isDatabaseError = errorMessage.includes('database') || 
                           errorMessage.includes('connection') ||
                           errorMessage.includes('timeout') ||
                           errorMessage.includes('P1001') ||
                           errorMessage.includes('P1002') ||
                           errorMessage.includes('P1017') ||
                           errorMessage.includes('Prisma') ||
                           errorMessage.includes('transaction')
    
    // 檢查是否是參數驗證錯誤
    const isValidationError = errorMessage.includes('缺少') ||
                             errorMessage.includes('無效') ||
                             errorMessage.includes('驗證')
    
    if (isValidationError) {
      return NextResponse.json(
        {
          error: errorMessage || '參數驗證失敗',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }
    
    if (isDatabaseError) {
      return NextResponse.json(
        {
          error: '資料庫操作失敗，請稍後再試',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          code: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }
    
    // 返回通用錯誤響應
    return NextResponse.json(
      {
        error: '伺服器錯誤，請稍後再試',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}
