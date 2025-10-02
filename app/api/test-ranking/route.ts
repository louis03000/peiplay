import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function POST() {
  try {
    // 檢查環境
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: '此操作不允許在生產環境執行' },
        { status: 403 }
      )
    }

    // 創建測試夥伴
    const partnerUser = await prisma.user.create({
      data: {
        email: 'ranking-test@example.com',
        password: 'test123',
        name: '排行榜測試夥伴',
        role: 'PARTNER',
        phone: '0900000001',
        birthday: new Date('1990-01-01'),
      },
    })

    const partner = await prisma.partner.create({
      data: {
        userId: partnerUser.id,
        name: '排行榜測試夥伴',
        birthday: new Date('1990-01-01'),
        phone: '0900000001',
        coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
        games: ['英雄聯盟', '傳說對決', '王者榮耀'],
        halfHourlyRate: 600,
        isAvailableNow: true,
        isRankBooster: true,
        status: 'APPROVED',
        customerMessage: '專業遊戲夥伴，讓您享受遊戲樂趣！',
      },
    })

    // 創建測試客戶
    const customerUser = await prisma.user.create({
      data: {
        email: 'ranking-customer@example.com',
        password: 'test123',
        name: '排行榜測試客戶',
        role: 'CUSTOMER',
        phone: '0900000002',
        birthday: new Date('1995-01-01'),
      },
    })

    const customer = await prisma.customer.create({
      data: {
        userId: customerUser.id,
        name: '排行榜測試客戶',
        birthday: new Date('1995-01-01'),
        phone: '0900000002',
      },
    })

    // 創建一些已完成的預約（過去7天）
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() - i) // 過去的日期
      
      // 創建上午時段
      const morningSchedule = await prisma.schedule.create({
        data: {
          partnerId: partner.id,
          date: date,
          startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0),
          endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
          isAvailable: false, // 已被預約
        },
      })

      // 創建下午時段
      const afternoonSchedule = await prisma.schedule.create({
        data: {
          partnerId: partner.id,
          date: date,
          startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 14, 0, 0),
          endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0, 0),
          isAvailable: false, // 已被預約
        },
      })

      // 創建已完成的預約
      await prisma.booking.create({
        data: {
          customerId: customer.id,
          scheduleId: morningSchedule.id,
          status: 'COMPLETED',
          originalAmount: 3000, // 3小時 * 500元/半小時 * 2
          finalAmount: 3000,
        },
      })

      await prisma.booking.create({
        data: {
          customerId: customer.id,
          scheduleId: afternoonSchedule.id,
          status: 'COMPLETED',
          originalAmount: 3000, // 3小時 * 500元/半小時 * 2
          finalAmount: 3000,
        },
      })
    }

    // 創建第二個夥伴（較少的預約）
    const partnerUser2 = await prisma.user.create({
      data: {
        email: 'ranking-test2@example.com',
        password: 'test123',
        name: '排行榜測試夥伴2',
        role: 'PARTNER',
        phone: '0900000003',
        birthday: new Date('1992-01-01'),
      },
    })

    const partner2 = await prisma.partner.create({
      data: {
        userId: partnerUser2.id,
        name: '排行榜測試夥伴2',
        birthday: new Date('1992-01-01'),
        phone: '0900000003',
        coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
        games: ['英雄聯盟', '傳說對決'],
        halfHourlyRate: 500,
        isAvailableNow: false,
        isRankBooster: false,
        status: 'APPROVED',
        customerMessage: '新手遊戲夥伴！',
      },
    })

    // 為第二個夥伴創建較少的預約
    for (let i = 0; i < 3; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      
      const schedule = await prisma.schedule.create({
        data: {
          partnerId: partner2.id,
          date: date,
          startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0, 0),
          endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 11, 0, 0),
          isAvailable: false,
        },
      })

      await prisma.booking.create({
        data: {
          customerId: customer.id,
          scheduleId: schedule.id,
          status: 'COMPLETED',
          originalAmount: 1000, // 1小時 * 500元/半小時 * 2
          finalAmount: 1000,
        },
      })
    }

    return NextResponse.json({
      message: '排行榜測試資料創建成功',
      data: {
        partner1: {
          name: partner.name,
          totalHours: 42, // 7天 * 2時段 * 3小時
        },
        partner2: {
          name: partner2.name,
          totalHours: 3, // 3天 * 1時段 * 1小時
        }
      }
    })
  } catch (error) {
    console.error('Error creating ranking test data:', error)
    return NextResponse.json(
      { error: '創建排行榜測試資料失敗', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}