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

    // 計算所需金幣 (1金幣 = 1元台幣)
    const requiredCoins = Math.ceil(duration * partner.halfHourlyRate * 2) // 每小時 = 2個半小時

    // 檢查用戶金幣餘額
    const userCoins = await prisma.userCoins.findUnique({
      where: { userId: session.user.id }
    })

    if (!userCoins || userCoins.coinBalance < requiredCoins) {
      return NextResponse.json({ 
        error: '金幣不足', 
        required: requiredCoins,
        current: userCoins?.coinBalance || 0
      }, { status: 400 })
    }

    // 使用事務確保資料一致性
    const result = await prisma.$transaction(async (tx) => {
      // 扣除金幣
      const updatedCoins = await tx.userCoins.update({
        where: { userId: session.user.id },
        data: { coinBalance: { decrement: requiredCoins } }
      })

      // 記錄消費交易
      await tx.coinTransaction.create({
        data: {
          userId: session.user.id,
          transactionType: 'BOOKING',
          amount: requiredCoins,
          description: `即時預約 ${partner.name} - ${duration}小時`,
          balanceBefore: updatedCoins.coinBalance + requiredCoins,
          balanceAfter: updatedCoins.coinBalance
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
          orderNumber: `INST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          originalAmount: requiredCoins, // 改為金幣數量
          finalAmount: requiredCoins,
          paymentInfo: {
            type: 'instant',
            duration: duration,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            rate: partner.halfHourlyRate,
            isInstantBooking: true,
            discordDelayMinutes: 3,
            coinsSpent: requiredCoins
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

      return { booking, coinsSpent: requiredCoins, newBalance: updatedCoins.coinBalance }
    })

    return NextResponse.json({
      id: result.booking.id,
      message: '即時預約創建成功',
      coinsSpent: result.coinsSpent,
      newBalance: result.newBalance,
      booking: {
        id: result.booking.id,
        status: result.booking.status,
        orderNumber: result.booking.orderNumber,
        duration: duration,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        requiredCoins: requiredCoins
      }
    })

  } catch (error) {
    console.error('即時預約創建失敗:', error)
    return NextResponse.json({ error: '預約創建失敗，請重試' }, { status: 500 })
  }
} 