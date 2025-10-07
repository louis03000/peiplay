import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendBookingNotificationToPartner } from '@/lib/email'


export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    console.log('即時預約 API 開始處理...')
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('用戶未登入')
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { partnerId, duration } = await request.json()
    console.log('請求參數:', { partnerId, duration, userId: session.user.id })

    if (!partnerId || !duration || duration <= 0) {
      console.log('參數不完整:', { partnerId, duration })
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 確保資料庫連接
    await prisma.$connect()
    
    // 檢查夥伴是否存在
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: { user: true }
    })

    if (!partner) {
      await prisma.$disconnect()
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 })
    }

    // 獲取客戶資訊
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
      include: { user: true }
    })

    if (!customer) {
      console.error('客戶資料不存在:', { userId: session.user.id })
      await prisma.$disconnect()
      return NextResponse.json({ error: '客戶資料不存在，請先完成個人資料設定' }, { status: 404 })
    }

    // 計算預約開始時間（現在）
    const now = new Date()
    const startTime = new Date(now.getTime() + 15 * 60 * 1000) // 15分鐘後開始
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000) // 加上預約時長

    // 計算費用（直接以台幣計算）
    const halfHourlyRate = partner.halfHourlyRate || 10 // 預設每半小時 10 元
    const totalCost = Math.ceil(duration * halfHourlyRate * 2) // 每小時 = 2個半小時

    // 檢查時間衝突 - 檢查夥伴是否有其他預約與新預約時間重疊
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        schedule: {
          partnerId: partnerId
        },
        status: {
          in: ['PENDING', 'CONFIRMED', 'PARTNER_ACCEPTED', 'PAID_WAITING_PARTNER_CONFIRMATION']
        },
        OR: [
          // 新預約開始時間在現有預約期間內
          {
            schedule: {
              startTime: { lte: startTime },
              endTime: { gt: startTime }
            }
          },
          // 新預約結束時間在現有預約期間內
          {
            schedule: {
              startTime: { lt: endTime },
              endTime: { gte: endTime }
            }
          },
          // 新預約完全包含現有預約
          {
            schedule: {
              startTime: { gte: startTime },
              endTime: { lte: endTime }
            }
          }
        ]
      },
      include: {
        schedule: true
      }
    })

    if (conflictingBookings.length > 0) {
      await prisma.$disconnect()
      const conflictTimes = conflictingBookings.map(b => 
        `${b.schedule.startTime.toLocaleString('zh-TW')} - ${b.schedule.endTime.toLocaleString('zh-TW')}`
      ).join(', ')
      return NextResponse.json({ 
        error: `時間衝突！該夥伴在以下時段已有預約：${conflictTimes}` 
      }, { status: 409 })
    }

    // 使用事務確保資料一致性
    const result = await prisma.$transaction(async (tx) => {
      // 立即關閉夥伴的「現在有空」狀態，防止重複預約
      await tx.partner.update({
        where: { id: partnerId },
        data: {
          isAvailableNow: false,
          availableNowSince: null
        }
      })

      // 為即時預約創建一個臨時的 schedule
      const tempSchedule = await tx.schedule.create({
        data: {
          partnerId: partnerId,
          date: startTime,
          startTime: startTime,
          endTime: endTime,
          isAvailable: false,
        }
      })

      // 創建預約記錄
      const booking = await tx.booking.create({
        data: {
          customerId: customer.id,
          scheduleId: tempSchedule.id,
          status: 'PENDING',
          orderNumber: `INST-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          originalAmount: totalCost,
          finalAmount: totalCost,
          paymentInfo: {
            type: 'instant',
            duration: duration,
            totalCost: totalCost
          }
        },
        include: {
          customer: true,
          schedule: {
            include: {
              partner: true
            }
          }
        }
      })

      return { booking, totalCost, startTime, endTime }
    })

    // 關閉資料庫連接
    await prisma.$disconnect()

    // 發送 email 通知和站內通知給夥伴
    try {
      // 發送 Email 通知
      await sendBookingNotificationToPartner(
        partner.user.email,
        partner.user.name || '夥伴',
        customer.user.name || '客戶',
        {
          duration: duration,
          startTime: result.startTime.toISOString(),
          endTime: result.endTime.toISOString(),
          totalCost: result.totalCost,
          isInstantBooking: true
        }
      )
      console.log('✅ 即時預約通知 email 已發送給夥伴')
    } catch (emailError) {
      console.error('❌ 發送即時預約通知失敗:', emailError)
      // 不影響預約創建，只記錄錯誤
    }

    return NextResponse.json({
      id: result.booking.id,
      message: '即時預約創建成功',
      totalCost: result.totalCost,
      booking: {
        id: result.booking.id,
        status: result.booking.status,
        orderNumber: result.booking.orderNumber,
        duration: duration,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        totalCost: result.totalCost
      }
    })

  } catch (error) {
    console.error('即時預約創建失敗:', error)
    console.error('錯誤堆疊:', error instanceof Error ? error.stack : 'No stack trace')
    
    // 確保連接關閉
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('關閉資料庫連接時發生錯誤:', disconnectError)
    }
    
    return NextResponse.json({ 
      error: '預約創建失敗，請重試',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}