import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 即時預約 API 開始處理...')
    
    const session = await getServerSession(authOptions)
    console.log('🔍 會話檢查:', { hasSession: !!session, userId: session?.user?.id })
    if (!session?.user?.id) {
      console.log('❌ 用戶未登入')
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    console.log('📝 解析請求數據...')
    const { partnerId, duration } = await request.json()
    console.log('📊 請求參數:', { partnerId, duration, userId: session.user.id })

    if (!partnerId || !duration || duration <= 0) {
      console.log('❌ 參數不完整:', { partnerId, duration })
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 確保資料庫連接
    console.log('🔌 測試資料庫連接...')
    await prisma.$connect()
    console.log('✅ 資料庫連接成功')
    
    // 檢查夥伴是否存在
    console.log('👤 檢查夥伴是否存在...')
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: { user: true }
    })
    console.log('🔍 夥伴查詢結果:', { partnerId, hasPartner: !!partner, partnerName: partner?.user?.name })

    if (!partner) {
      console.log('❌ 夥伴不存在')
      await prisma.$disconnect()
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 })
    }

    // 獲取或創建客戶資訊
    console.log('👥 檢查客戶記錄...')
    let customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
      include: { user: true }
    })
    console.log('🔍 客戶記錄查詢結果:', { hasCustomer: !!customer, customerId: customer?.id })

    if (!customer) {
      console.log('➕ 客戶資料不存在，自動創建客戶記錄:', { userId: session.user.id })
      // 自動創建客戶記錄
      customer = await prisma.customer.create({
        data: {
          userId: session.user.id,
          name: session.user.name || '客戶',
          birthday: new Date('1990-01-01'), // 預設生日
          phone: '0000000000' // 預設電話
        },
        include: { user: true }
      })
      console.log('✅ 客戶記錄創建成功:', { customerId: customer.id })
    }

    // 計算預約開始時間（現在）
    console.log('⏰ 計算預約時間...')
    const now = new Date()
    const startTime = new Date(now.getTime() + 15 * 60 * 1000) // 15分鐘後開始
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000) // 加上預約時長
    console.log('📅 時間計算結果:', { 
      now: now.toISOString(), 
      startTime: startTime.toISOString(), 
      endTime: endTime.toISOString(),
      duration 
    })

    // 計算費用（直接以台幣計算）
    console.log('💰 計算費用...')
    const halfHourlyRate = partner.halfHourlyRate || 10 // 預設每半小時 10 元
    const totalCost = Math.ceil(duration * halfHourlyRate * 2) // 每小時 = 2個半小時
    console.log('💵 費用計算結果:', { halfHourlyRate, totalCost, duration })

    // 檢查時間衝突 - 檢查夥伴是否有其他預約與新預約時間重疊
    console.log('🔍 檢查時間衝突...')
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

    console.log('🔍 衝突檢查結果:', { conflictCount: conflictingBookings.length })
    if (conflictingBookings.length > 0) {
      console.log('❌ 發現時間衝突')
      await prisma.$disconnect()
      const conflictTimes = conflictingBookings.map(b => 
        `${b.schedule.startTime.toLocaleString('zh-TW')} - ${b.schedule.endTime.toLocaleString('zh-TW')}`
      ).join(', ')
      return NextResponse.json({ 
        error: `時間衝突！該夥伴在以下時段已有預約：${conflictTimes}` 
      }, { status: 409 })
    }

    // 使用事務確保資料一致性
    console.log('🔄 開始資料庫事務...')
    const result = await prisma.$transaction(async (tx) => {
      console.log('🔒 關閉夥伴「現在有空」狀態...')
      // 立即關閉夥伴的「現在有空」狀態，防止重複預約
      await tx.partner.update({
        where: { id: partnerId },
        data: {
          isAvailableNow: false,
          availableNowSince: null
        }
      })
      console.log('✅ 夥伴狀態已更新')

      // 為即時預約創建一個臨時的 schedule
      console.log('📅 創建臨時時段...')
      const tempSchedule = await tx.schedule.create({
        data: {
          partnerId: partnerId,
          date: startTime,
          startTime: startTime,
          endTime: endTime,
          isAvailable: false,
        }
      })
      console.log('✅ 臨時時段創建成功:', { scheduleId: tempSchedule.id })

      // 創建預約記錄
      console.log('📝 創建預約記錄...')
      const booking = await tx.booking.create({
        data: {
          customerId: customer.id,
          scheduleId: tempSchedule.id,
          status: 'CONFIRMED' as any, // 即時預約直接確認，不需要夥伴再次確認
          orderNumber: `INST-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          originalAmount: totalCost,
          finalAmount: totalCost,
          paymentInfo: {
            type: 'instant',
            duration: duration,
            totalCost: totalCost,
            isInstantBooking: 'true',
            discordDelayMinutes: '3' // 3分鐘後開啟語音頻道
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
    console.log('✅ 資料庫事務完成')

    // 關閉資料庫連接
    await prisma.$disconnect()

    // 暫時移除 email 發送，專注於預約創建
    console.log('✅ 即時預約創建成功，跳過 email 發送')

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
    
    // 如果是資料庫連接錯誤，返回更友好的錯誤信息
    if (error instanceof Error && error.message.includes('connect')) {
      return NextResponse.json({ 
        error: '資料庫連接失敗，請稍後再試',
        success: false
      }, { status: 503 })
    }
    
    // 確保連接關閉
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('關閉資料庫連接時發生錯誤:', disconnectError)
    }
    
    return NextResponse.json({ 
      error: '預約創建失敗，請重試',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}