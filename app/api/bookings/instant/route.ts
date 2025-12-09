import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { sendBookingNotificationEmail } from '@/lib/email'
import { BookingStatus } from '@prisma/client'
import { checkPartnerCurrentlyBusy, checkTimeConflict } from '@/lib/time-conflict'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()
  let requestData: any
  try {
    requestData = await request.json()
  } catch (error) {
    return NextResponse.json({ error: '無效的請求數據' }, { status: 400 })
  }

  try {
    console.log('📥 收到即時預約請求:', { partnerId: requestData.partnerId, duration: requestData.duration })
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('❌ 未登入')
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { partnerId, duration } = requestData

    if (!partnerId || !duration || duration <= 0) {
      console.log('❌ 參數驗證失敗:', { partnerId, duration })
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      try {
        console.log('🔍 開始查詢客戶資料...')
        const customer = await client.customer.findUnique({
          where: { userId: session.user.id },
          include: { user: true },
        })

        if (!customer) {
          console.log('❌ 客戶資料不存在')
          return { type: 'NO_CUSTOMER' } as const
        }

        console.log('🔍 開始查詢夥伴資料...')
        const partner = await client.partner.findUnique({
          where: { id: partnerId },
          include: { user: true },
        })

        if (!partner) {
          console.log('❌ 夥伴不存在')
          return { type: 'NO_PARTNER' } as const
        }

        console.log('🔍 檢查夥伴是否忙碌...')
        const busyCheck = await checkPartnerCurrentlyBusy(partner.id, client)
        if (busyCheck.isBusy) {
          console.log('❌ 夥伴目前忙碌')
          return { type: 'BUSY', busyCheck } as const
        }

        const now = new Date()
        const startTime = new Date(now.getTime() + 15 * 60 * 1000)
        const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000)

        console.log('🔍 檢查時間衝突...')
        const conflict = await checkTimeConflict(partner.id, startTime, endTime, undefined, client)
        if (conflict.hasConflict) {
          console.log('❌ 時間衝突')
          return { type: 'CONFLICT', conflict } as const
        }

        const pricing = {
          duration,
          originalAmount: duration * partner.halfHourlyRate * 2,
        }

        console.log('🔍 開始創建預約（事務）...')
        const { schedule, booking } = await client.$transaction(
          async (tx) => {
            console.log('📝 創建時段...')
            const createdSchedule = await tx.schedule.create({
              data: {
                partnerId: partner.id,
                date: startTime,
                startTime,
                endTime,
                isAvailable: false,
              },
            })

            console.log('📝 創建預約...')
            const createdBooking = await tx.booking.create({
              data: {
                customerId: customer.id,
                partnerId: partner.id,
                scheduleId: createdSchedule.id,
                status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
                originalAmount: pricing.originalAmount,
                finalAmount: pricing.originalAmount,
                paymentInfo: {
                  isInstantBooking: true,
                },
              },
            })

            return { schedule: createdSchedule, booking: createdBooking }
          },
          {
            maxWait: 10000, // 等待事務開始的最大時間（10秒）
            timeout: 20000, // 事務執行的最大時間（20秒）
          }
        )

        console.log('✅ 預約創建成功')
        return { type: 'SUCCESS', customer, partner, schedule, booking, pricing, startTime, endTime } as const
      } catch (dbError) {
        console.error('❌ 資料庫操作錯誤:', dbError)
        console.error('錯誤詳情:', {
          message: dbError instanceof Error ? dbError.message : 'Unknown error',
          stack: dbError instanceof Error ? dbError.stack : undefined,
          name: dbError instanceof Error ? dbError.name : undefined,
        })
        throw dbError
      }
    }, 'bookings:instant')

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

    // 非阻塞寄信
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
      console.error('❌ Email 發送失敗:', error)
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
    console.error('❌ 即時預約創建失敗:', error)
    console.error('錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    
    // 返回更詳細的錯誤信息給前端
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isDatabaseError = errorMessage.includes('database') || 
                           errorMessage.includes('connection') ||
                           errorMessage.includes('timeout') ||
                           errorMessage.includes('P1001') ||
                           errorMessage.includes('P1002') ||
                           errorMessage.includes('P1017')
    
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
    
    return createErrorResponse(error, 'bookings:instant')
  }
}