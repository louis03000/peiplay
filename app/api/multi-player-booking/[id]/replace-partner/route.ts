import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { BookingStatus } from '@prisma/client'
import { checkTimeConflict } from '@/lib/time-conflict'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 重新選擇夥伴（替換被拒絕的夥伴）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const multiPlayerBookingId = resolvedParams.id
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const body = await request.json()
    const { rejectedBookingId, newScheduleId } = body

    if (!rejectedBookingId || !newScheduleId) {
      return NextResponse.json({ error: '缺少必要參數：rejectedBookingId, newScheduleId' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      // 查找客戶資料
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
          customer: {
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
      })

      if (!multiPlayerBooking) {
        return { type: 'NOT_FOUND' } as const
      }

      if (multiPlayerBooking.customerId !== customer.id) {
        return { type: 'FORBIDDEN' } as const
      }

      // 查找被拒絕的 Booking
      const rejectedBooking = multiPlayerBooking.bookings.find(
        b => b.id === rejectedBookingId && 
        (b.status === 'REJECTED' || b.status === 'PARTNER_REJECTED')
      )

      if (!rejectedBooking) {
        return { type: 'REJECTED_BOOKING_NOT_FOUND' } as const
      }

      // 查找新的時段
      const newSchedule = await client.schedule.findUnique({
        where: { id: newScheduleId },
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
            select: {
              id: true,
              hourlyRate: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          bookings: {
            where: {
              status: {
                notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'],
              },
            },
            select: {
              id: true,
              status: true,
            },
          },
        },
      })

      if (!newSchedule) {
        return { type: 'SCHEDULE_NOT_FOUND' } as const
      }

      // 檢查時段是否已被預約
      if (newSchedule.bookings && newSchedule.bookings.length > 0) {
        return { type: 'SCHEDULE_ALREADY_BOOKED' } as const
      }

      // 檢查時間衝突
      const hasConflict = await checkTimeConflict(
        newSchedule.partner.id,
        newSchedule.startTime,
        newSchedule.endTime,
        client
      )

      if (hasConflict) {
        return { type: 'TIME_CONFLICT' } as const
      }

      // 計算新夥伴的金額（使用相同的時長和時薪）
      const duration = (multiPlayerBooking.endTime.getTime() - multiPlayerBooking.startTime.getTime()) / (1000 * 60 * 60)
      const partnerHourlyRate = newSchedule.partner.hourlyRate || 0
      const newAmount = duration * partnerHourlyRate

      // 在事務中執行替換
      return await client.$transaction(async (tx) => {
        // 1. 刪除被拒絕的 Booking（標記為 CANCELLED）
        await tx.booking.update({
          where: { id: rejectedBookingId },
          data: { status: BookingStatus.CANCELLED },
        })

        // 2. 創建新的 Booking
        const newBooking = await tx.booking.create({
          data: {
            customerId: customer.id,
            partnerId: newSchedule.partner.id,
            scheduleId: newScheduleId,
            status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
            originalAmount: newAmount,
            finalAmount: newAmount,
            isMultiPlayerBooking: true,
            multiPlayerBookingId: multiPlayerBooking.id,
            paymentInfo: {
              isInstantBooking: false,
              isMultiPlayerBooking: true,
            },
          },
        })

        // 3. 重新計算總金額
        const allBookings = await tx.booking.findMany({
          where: {
            multiPlayerBookingId: multiPlayerBooking.id,
            status: {
              notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED],
            },
          },
          select: {
            finalAmount: true,
          },
        })

        const newTotalAmount = allBookings.reduce((sum, b) => sum + (b.finalAmount || 0), 0)

        // 4. 更新 MultiPlayerBooking 的總金額
        await tx.multiPlayerBooking.update({
          where: { id: multiPlayerBooking.id },
          data: {
            totalAmount: newTotalAmount,
            lastAdjustmentAt: new Date(),
          },
        })

        return {
          type: 'SUCCESS',
          newBooking,
          multiPlayerBooking: {
            ...multiPlayerBooking,
            totalAmount: newTotalAmount,
          },
        } as const
      })
    }, 'multi-player-booking:replace-partner')

    if (result.type === 'NO_CUSTOMER') {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
    }
    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '多人陪玩群組不存在' }, { status: 404 })
    }
    if (result.type === 'FORBIDDEN') {
      return NextResponse.json({ error: '無權限操作此預約' }, { status: 403 })
    }
    if (result.type === 'REJECTED_BOOKING_NOT_FOUND') {
      return NextResponse.json({ error: '找不到被拒絕的預約' }, { status: 404 })
    }
    if (result.type === 'SCHEDULE_NOT_FOUND') {
      return NextResponse.json({ error: '找不到選擇的時段' }, { status: 404 })
    }
    if (result.type === 'SCHEDULE_ALREADY_BOOKED') {
      return NextResponse.json({ error: '該時段已被預約，請選擇其他時段' }, { status: 409 })
    }
    if (result.type === 'TIME_CONFLICT') {
      return NextResponse.json({ error: '該時段與其他預約衝突' }, { status: 409 })
    }

    // 發送通知給新夥伴（異步處理，不阻塞響應）
    Promise.resolve().then(async () => {
      try {
        const { sendBookingNotificationEmail } = await import('@/lib/email')
        const newSchedule = await db.query(async (client) => {
          return client.schedule.findUnique({
            where: { id: newScheduleId },
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
            },
          })
        }, 'multi-player-booking:replace-partner:get-schedule')

        if (newSchedule?.partner?.user?.email) {
          await sendBookingNotificationEmail(
            newSchedule.partner.user.email,
            newSchedule.partner.user.name || '夥伴',
            result.multiPlayerBooking.customer.user.name || '顧客',
            {
              startTime: result.multiPlayerBooking.startTime.toISOString(),
              endTime: result.multiPlayerBooking.endTime.toISOString(),
              bookingId: result.newBooking.id,
            }
          ).catch((error) => {
            console.error('❌ 發送通知給新夥伴失敗:', error)
          })
        }
      } catch (error) {
        console.error('❌ 處理新夥伴通知失敗:', error)
      }
    })

    return NextResponse.json({
      success: true,
      message: '夥伴已成功替換',
      booking: result.newBooking,
      multiPlayerBooking: result.multiPlayerBooking,
    })
  } catch (error) {
    return createErrorResponse(error, 'multi-player-booking:replace-partner')
  }
}

