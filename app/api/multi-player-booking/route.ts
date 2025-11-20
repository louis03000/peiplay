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
    console.log('🔵 開始創建多人陪玩群組...')
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const body = await request.json()
    console.log('📥 接收到的請求數據:', { 
      date: body.date, 
      startTime: body.startTime, 
      endTime: body.endTime,
      games: body.games,
      partnerScheduleIds: body.partnerScheduleIds 
    })

    const { date, startTime, endTime, games, partnerScheduleIds } = body

    // 驗證必要參數
    if (!date || !startTime || !endTime || !Array.isArray(partnerScheduleIds) || partnerScheduleIds.length === 0) {
      console.log('❌ 缺少必要參數')
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 檢查時段是否在「現在+2小時」之後
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    
    // 確保時間格式正確
    const startTimeStr = startTime.includes(':') ? startTime : `${startTime.slice(0, 2)}:${startTime.slice(2)}`
    const endTimeStr = endTime.includes(':') ? endTime : `${endTime.slice(0, 2)}:${endTime.slice(2)}`
    
    const selectedStartTime = new Date(`${date}T${startTimeStr}:00`)
    
    if (isNaN(selectedStartTime.getTime())) {
      return NextResponse.json({ error: '開始時間格式錯誤' }, { status: 400 })
    }
    
    if (selectedStartTime <= twoHoursLater) {
      return NextResponse.json({ 
        error: '預約時段必須在現在時間的2小時之後',
        minTime: twoHoursLater.toISOString()
      }, { status: 400 })
    }

    const startDateTime = new Date(`${date}T${startTimeStr}:00`)
    const endDateTime = new Date(`${date}T${endTimeStr}:00`)
    
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return NextResponse.json({ error: '時間格式錯誤' }, { status: 400 })
    }

    if (endDateTime <= startDateTime) {
      return NextResponse.json({ error: '結束時間必須晚於開始時間' }, { status: 400 })
    }

    console.log('🔍 開始查詢客戶資料...')
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
        console.log('❌ 客戶資料不存在')
        return { type: 'NO_CUSTOMER' } as const
      }

      // 檢查違規次數（滿3次停權）
      if (customer.violationCount >= 3) {
        console.log('❌ 帳號已被停權')
        return { type: 'SUSPENDED' } as const
      }

      console.log('✅ 客戶資料驗證通過，開始事務...')
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
          console.log(`🔍 查詢時段 ${scheduleId}...`)
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
            console.log(`❌ 時段 ${scheduleId} 不存在`)
            throw new Error(`時段 ${scheduleId} 不存在`)
          }
          
          console.log(`✅ 時段 ${scheduleId} 找到，開始驗證...`)

          // 檢查時段是否可用
          if (!schedule.isAvailable) {
            throw new Error(`夥伴 ${schedule.partner.user.name} 的時段不可用`)
          }

          // 檢查時段是否已被預約
          // 注意：Schedule.bookings 是單個對象（Booking?），不是數組
          if (schedule.bookings && 
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
          // 確保時間是 Date 對象
          const conflictStartTime = schedule.startTime instanceof Date ? schedule.startTime : new Date(schedule.startTime)
          const conflictEndTime = schedule.endTime instanceof Date ? schedule.endTime : new Date(schedule.endTime)
          const conflict = await checkTimeConflict(
            schedule.partnerId,
            conflictStartTime,
            conflictEndTime,
            undefined,
            tx
          )

          if (conflict.hasConflict) {
            throw new Error(`夥伴 ${schedule.partner.user.name} 的時間有衝突`)
          }

          // 計算費用
          // 確保時間是 Date 對象
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
            schedule,
            amount,
          })
        }

        // 創建多人陪玩群組
        console.log('📝 創建多人陪玩群組記錄...', {
          customerId: customer.id,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          totalAmount
        })
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
        console.log('✅ 多人陪玩群組創建成功:', multiPlayerBooking.id)

        // 為每個夥伴創建 booking
        const bookingRecords: Array<{
          bookingId: string
          partnerEmail: string
          partnerName: string
          amount: number
        }> = []

        console.log(`📝 開始為 ${partnerData.length} 位夥伴創建預約...`)
        for (const partner of partnerData) {
          try {
            console.log(`📝 創建預約: 夥伴 ${partner.partnerName}, 時段 ${partner.scheduleId}`)
            console.log('📝 預約數據:', {
              customerId: customer.id,
              scheduleId: partner.scheduleId,
              status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
              originalAmount: partner.amount,
              finalAmount: partner.amount,
              isMultiPlayerBooking: true,
              multiPlayerBookingId: multiPlayerBooking.id,
            })
            
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
            console.log(`✅ 預約創建成功: ${booking.id}`)

            bookingRecords.push({
              bookingId: booking.id,
              partnerEmail: partner.partnerEmail,
              partnerName: partner.partnerName,
              amount: partner.amount,
            })
          } catch (bookingError) {
            console.error(`❌ 創建預約失敗 (夥伴 ${partner.partnerName}):`, bookingError)
            throw bookingError
          }
        }
        console.log('✅ 所有預約創建完成')

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
    console.error('❌ 創建多人陪玩群組失敗:', error)
    console.error('❌ 錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    
    // 如果是 Prisma 錯誤，輸出更多詳情
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('❌ Prisma 錯誤代碼:', (error as any).code)
      console.error('❌ Prisma 錯誤詳情:', (error as any).meta)
    }
    
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

