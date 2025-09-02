import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { partnerId, duration } = await request.json()

    if (!partnerId || !duration || duration <= 0) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 檢查夥伴是否存在
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: { user: true }
    })

    if (!partner) {
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 })
    }

    // 檢查夥伴是否現在有空
    if (!partner.isAvailableNow) {
      return NextResponse.json({ error: '夥伴目前沒有空閒時間' }, { status: 400 })
    }

    // 獲取客戶資訊
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    })

    if (!customer) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
    }

    // 計算預約開始時間（現在）
    const now = new Date()
    const startTime = new Date(now.getTime() + 15 * 60 * 1000) // 15分鐘後開始
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000) // 加上預約時長

    // 計算金額
    const totalAmount = duration * partner.halfHourlyRate * 2 // 每小時 = 2個半小時

    // 為即時預約創建一個臨時的 schedule
    const tempSchedule = await prisma.schedule.create({
      data: {
        partnerId: partnerId,
        date: startTime,
        startTime: startTime,
        endTime: endTime,
        isAvailable: false, // 立即標記為不可用
      }
    })

    // 創建預約記錄
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        scheduleId: tempSchedule.id, // 使用新創建的 schedule ID
        status: 'PENDING', // 等待夥伴確認
        orderNumber: `INST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        originalAmount: totalAmount,
        finalAmount: totalAmount,
        paymentInfo: {
          type: 'instant',
          duration: duration,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          rate: partner.halfHourlyRate,
          isInstantBooking: true, // 標記為即時預約
          discordDelayMinutes: 3 // Discord 頻道延遲開啟時間（分鐘）
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

    return NextResponse.json({
      id: booking.id,
      message: '即時預約創建成功',
      booking: {
        id: booking.id,
        status: booking.status,
        orderNumber: booking.orderNumber,
        duration: duration,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalAmount: duration * partner.halfHourlyRate * 2 // 每小時 = 2個半小時
      }
    })

  } catch (error) {
    console.error('即時預約創建失敗:', error)
    return NextResponse.json({ error: '預約創建失敗，請重試' }, { status: 500 })
  }
} 