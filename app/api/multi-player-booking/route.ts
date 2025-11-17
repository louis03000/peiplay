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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { date, startTime, endTime, games, partnerScheduleIds } = await request.json()

    // 驗證必要參數
    if (!date || !startTime || !endTime || !Array.isArray(partnerScheduleIds) || partnerScheduleIds.length === 0) {
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

    const startDateTime = new Date(`${date}T${startTime}:00`)
    const endDateTime = new Date(`${date}T${endTime}:00`)

    if (endDateTime <= startDateTime) {
      return NextResponse.json({ error: '結束時間必須晚於開始時間' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      // 查找客戶資料
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
        return { type: 'NO_CUSTOMER' } as const
      }

      // 檢查違規次數（滿3次停權）
      if (customer.violationCount >= 3) {
        return { type: 'SUSPENDED' } as const
      }

      return await client.$transaction(async (tx) => {
        // 驗證所有夥伴的時段並計算總費用
        const partnerData: Array<{
          scheduleId: string
          partnerId: string
          partnerName: string
          partnerEmail: string
          schedule: any
          amount: number
        }> = []

        let totalAmount = 0

        for (const scheduleId of partnerScheduleIds) {
          const schedule = await tx.schedule.findUnique({
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
            throw new Error(`時段 ${scheduleId} 不存在`)
          }

          // 檢查時段是否可用
          if (!schedule.isAvailable) {
            throw new Error(`夥伴 ${schedule.partner.user.name} 的時段不可用`)
          }

          // 檢查時段是否已被預約
          if (schedule.bookings && schedule.bookings.status && 
              schedule.bookings.status !== 'CANCELLED' && 
              schedule.bookings.status !== 'REJECTED') {
            throw new Error(`夥伴 ${schedule.partner.user.name} 的時段已被預約`)
          }

          // 檢查時段是否完全匹配
          const scheduleStart = new Date(schedule.startTime)
          const scheduleEnd = new Date(schedule.endTime)
          
          if (scheduleStart.getTime() !== startDateTime.getTime() || 
              scheduleEnd.getTime() !== endDateTime.getTime()) {
            throw new Error(`夥伴 ${schedule.partner.user.name} 的時段不匹配`)
          }

          // 檢查時間衝突
          const conflict = await checkTimeConflict(
            schedule.partnerId,
            schedule.startTime,
            schedule.endTime,
            undefined,
            tx
          )

          if (conflict.hasConflict) {
            throw new Error(`夥伴 ${schedule.partner.user.name} 的時間有衝突`)
          }

          // 計算費用
          const durationHours = (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60)
          const amount = durationHours * schedule.partner.halfHourlyRate * 2
          totalAmount += amount

          partnerData.push({
            scheduleId: schedule.id,
            partnerId: schedule.partnerId,
            partnerName: schedule.partner.user.name || '夥伴',
            partnerEmail: schedule.partner.user.email,
            schedule,
            amount,
          })
        }

        // 創建多人陪玩群組
        const multiPlayerBooking = await tx.multiPlayerBooking.create({
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

        // 為每個夥伴創建 booking
        const bookingRecords: Array<{
          bookingId: string
          partnerEmail: string
          partnerName: string
          amount: number
        }> = []

        for (const partner of partnerData) {
          const booking = await tx.booking.create({
            data: {
              customerId: customer.id,
              scheduleId: partner.scheduleId,
              status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
              originalAmount: partner.amount,
              finalAmount: partner.amount,
              isMultiPlayerBooking: true,
              multiPlayerBookingId: multiPlayerBooking.id,
            },
          })

          bookingRecords.push({
            bookingId: booking.id,
            partnerEmail: partner.partnerEmail,
            partnerName: partner.partnerName,
            amount: partner.amount,
          })
        }

        return {
          type: 'SUCCESS' as const,
          multiPlayerBooking,
          bookings: bookingRecords,
          customer,
        }
      })
    }, 'multi-player-booking:create')

    if (result.type === 'NO_CUSTOMER') {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
    }

    if (result.type === 'SUSPENDED') {
      return NextResponse.json({ error: '您的帳號已被停權，無法創建預約' }, { status: 403 })
    }

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
        console.error('❌ Email 發送失敗:', error)
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
  } catch (error) {
    console.error('創建多人陪玩群組失敗:', error)
    return createErrorResponse(error, 'multi-player-booking:create')
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

      return client.multiPlayerBooking.findMany({
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
    }, 'multi-player-booking:list')

    if (result === null) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
    }

    return NextResponse.json({ multiPlayerBookings: result })
  } catch (error) {
    return createErrorResponse(error, 'multi-player-booking:list')
  }
}

