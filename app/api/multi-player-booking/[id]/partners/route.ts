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
 * 重新選擇夥伴（新增夥伴到多人陪玩群組）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const multiPlayerBookingId = resolvedParams.id
    const { partnerScheduleIds } = await request.json()

    if (!Array.isArray(partnerScheduleIds) || partnerScheduleIds.length === 0) {
      return NextResponse.json({ error: '請提供夥伴時段ID' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })

      if (!customer) {
        return { type: 'NO_CUSTOMER' } as const
      }

      // 查找多人陪玩群組
      const multiPlayerBooking = await client.multiPlayerBooking.findUnique({
        where: { id: multiPlayerBookingId },
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
      })

      if (!multiPlayerBooking) {
        return { type: 'NOT_FOUND' } as const
      }

      if (multiPlayerBooking.customerId !== customer.id) {
        return { type: 'FORBIDDEN' } as const
      }

      // 檢查調整期限（時段開始前30分鐘）
      const now = new Date()
      const thirtyMinutesBeforeStart = new Date(multiPlayerBooking.startTime.getTime() - 30 * 60 * 1000)
      
      if (now >= thirtyMinutesBeforeStart) {
        return { type: 'ADJUSTMENT_CLOSED' } as const
      }

      // 檢查群組狀態
      if (multiPlayerBooking.status === 'COMPLETED' || multiPlayerBooking.status === 'CANCELLED') {
        return { type: 'INVALID_STATUS' } as const
      }

      return await client.$transaction(async (tx) => {
        const newBookings: Array<{
          bookingId: string
          partnerEmail: string
          partnerName: string
          amount: number
        }> = []

        let additionalAmount = 0

        // 驗證新夥伴的時段
        for (const scheduleId of partnerScheduleIds) {
          // 檢查是否已經在群組中
          const existingBooking = multiPlayerBooking.bookings.find(
            b => b.scheduleId === scheduleId && 
            b.status !== 'CANCELLED' && 
            b.status !== 'REJECTED'
          )

          if (existingBooking) {
            throw new Error('該夥伴已經在群組中')
          }

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
          
          if (scheduleStart.getTime() !== multiPlayerBooking.startTime.getTime() || 
              scheduleEnd.getTime() !== multiPlayerBooking.endTime.getTime()) {
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
          additionalAmount += amount

          // 創建 booking
          const booking = await tx.booking.create({
            data: {
              customerId: customer.id,
              scheduleId: schedule.id,
              status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
              originalAmount: amount,
              finalAmount: amount,
              isMultiPlayerBooking: true,
              multiPlayerBookingId: multiPlayerBooking.id,
            },
          })

          newBookings.push({
            bookingId: booking.id,
            partnerEmail: schedule.partner.user.email,
            partnerName: schedule.partner.user.name || '夥伴',
            amount,
          })
        }

        // 更新群組總金額和最後調整時間
        await tx.multiPlayerBooking.update({
          where: { id: multiPlayerBookingId },
          data: {
            totalAmount: multiPlayerBooking.totalAmount + additionalAmount,
            lastAdjustmentAt: new Date(),
          },
        })

        return {
          type: 'SUCCESS' as const,
          newBookings,
          additionalAmount,
          customer,
        }
      })
    }, 'multi-player-booking:add-partners')

    if (result.type === 'NO_CUSTOMER') {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
    }

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '多人陪玩群組不存在' }, { status: 404 })
    }

    if (result.type === 'FORBIDDEN') {
      return NextResponse.json({ error: '無權限操作此群組' }, { status: 403 })
    }

    if (result.type === 'ADJUSTMENT_CLOSED') {
      return NextResponse.json({ error: '時段開始前30分鐘無法再調整' }, { status: 400 })
    }

    if (result.type === 'INVALID_STATUS') {
      return NextResponse.json({ error: '群組狀態不允許調整' }, { status: 400 })
    }

    // 發送通知（非阻塞）
    for (const booking of result.newBookings) {
      sendBookingNotificationEmail(
        booking.partnerEmail,
        booking.partnerName,
        result.customer.user.name || '客戶',
        {
          bookingId: booking.bookingId,
          startTime: new Date().toISOString(), // 這裡應該從群組獲取
          endTime: new Date().toISOString(),
          duration: 0,
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
      newBookings: result.newBookings.map(b => ({
        id: b.bookingId,
        amount: b.amount,
      })),
      additionalAmount: result.additionalAmount,
    })
  } catch (error) {
    console.error('新增夥伴失敗:', error)
    return createErrorResponse(error, 'multi-player-booking:add-partners')
  }
}

