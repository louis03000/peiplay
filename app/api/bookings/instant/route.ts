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
  let requestData: any
  try {
    requestData = await request.json()
  } catch (error) {
    return NextResponse.json({ error: '無效的請求數據' }, { status: 400 })
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { partnerId, duration } = requestData

    if (!partnerId || !duration || duration <= 0) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        include: { user: true },
      })

      if (!customer) {
        return { type: 'NO_CUSTOMER' } as const
      }

      const partner = await client.partner.findUnique({
        where: { id: partnerId },
        include: { user: true },
      })

      if (!partner) {
        return { type: 'NO_PARTNER' } as const
      }

      const busyCheck = await checkPartnerCurrentlyBusy(partner.id, client)
      if (busyCheck.isBusy) {
        return { type: 'BUSY', busyCheck } as const
      }

      const now = new Date()
      const startTime = new Date(now.getTime() + 15 * 60 * 1000)
      const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000)

      const conflict = await checkTimeConflict(partner.id, startTime, endTime, undefined, client)
      if (conflict.hasConflict) {
        return { type: 'CONFLICT', conflict } as const
      }

      const pricing = {
        duration,
        originalAmount: duration * partner.halfHourlyRate * 2,
      }

      const { schedule, booking } = await client.$transaction(async (tx) => {
        const createdSchedule = await tx.schedule.create({
          data: {
            partnerId: partner.id,
            date: startTime,
            startTime,
            endTime,
            isAvailable: false,
          },
        })

        const createdBooking = await tx.booking.create({
          data: {
            customerId: customer.id,
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
      })

      return { type: 'SUCCESS', customer, partner, schedule, booking, pricing, startTime, endTime } as const
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
    return createErrorResponse(error, 'bookings:instant')
  }
}