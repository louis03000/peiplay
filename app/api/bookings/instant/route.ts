import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    // 檢查夥伴是否存在
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: { user: true }
    })

    if (!partner) {
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 })
    }

    // 檢查夥伴是否現在有空 - 暫時移除檢查，允許所有夥伴
    // if (!partner.isAvailableNow) {
    //   return NextResponse.json({ error: '夥伴目前沒有空閒時間' }, { status: 400 })
    // }

    // 獲取客戶資訊
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    })

    if (!customer) {
      console.error('客戶資料不存在:', { userId: session.user.id })
      return NextResponse.json({ error: '客戶資料不存在，請先完成個人資料設定' }, { status: 404 })
    }

    // 計算預約開始時間（現在）
    const now = new Date()
    const startTime = new Date(now.getTime() + 15 * 60 * 1000) // 15分鐘後開始
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000) // 加上預約時長

    // 計算費用（直接以台幣計算）
    const halfHourlyRate = partner.halfHourlyRate || 10 // 預設每半小時 10 元
    const totalCost = Math.ceil(duration * halfHourlyRate * 2) // 每小時 = 2個半小時

    // 移除金幣檢查，改為直接標明價格

    // 使用事務確保資料一致性
    const result = await prisma.$transaction(async (tx) => {
      // 移除金幣相關操作，改為直接標明價格

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
          originalAmount: totalCost, // 改為台幣金額
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

      return { booking, totalCost: totalCost }
    })

    return NextResponse.json({
      id: result.booking.id,
      message: '即時預約創建成功',
      totalCost: result.totalCost,
      booking: {
        id: result.booking.id,
        status: result.booking.status,
        orderNumber: result.booking.orderNumber,
        duration: duration,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalCost: totalCost
      }
    })

  } catch (error) {
    console.error('即時預約創建失敗:', error)
    console.error('錯誤堆疊:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: '預約創建失敗，請重試',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 