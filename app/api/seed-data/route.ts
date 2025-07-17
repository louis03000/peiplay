import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DatabaseManager } from '@/lib/db-utils'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    // 檢查環境
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: '此操作不允許在生產環境執行' },
        { status: 403 }
      )
    }

    // 檢查是否有重要資料
    const dataCheck = await DatabaseManager.hasImportantData()
    
    if (dataCheck.hasUsers || dataCheck.hasPartners) {
      return NextResponse.json({
        error: '資料庫包含重要資料，為防止資料遺失，操作已取消',
        dataCheck,
        suggestion: '如果您確定要重新創建測試資料，請先手動備份重要資料'
      }, { status: 400 })
    }

    // 清空現有資料
    await prisma.booking.deleteMany()
    await prisma.schedule.deleteMany()
    await prisma.customer.deleteMany()
    await prisma.partner.deleteMany()
    await prisma.user.deleteMany()

    // 創建管理員
    const adminPassword = await bcrypt.hash('admin123', 10)
    const admin = await prisma.user.create({
      data: {
        email: 'admin@peiplay.com',
        password: adminPassword,
        name: '管理員',
        role: 'ADMIN',
        phone: '0900000000',
        birthday: new Date('1990-01-01'),
      },
    })

    // 創建測試用戶1
    const user1Password = await bcrypt.hash('user123', 10)
    const user1 = await prisma.user.create({
      data: {
        email: 'user1@example.com',
        password: user1Password,
        name: '測試用戶1',
        role: 'CUSTOMER',
        phone: '0912345678',
        birthday: new Date('1995-01-01'),
      },
    })

    // 創建測試用戶2
    const user2Password = await bcrypt.hash('user123', 10)
    const user2 = await prisma.user.create({
      data: {
        email: 'user2@example.com',
        password: user2Password,
        name: '測試用戶2',
        role: 'CUSTOMER',
        phone: '0923456789',
        birthday: new Date('1998-01-01'),
      },
    })

    // 創建夥伴
    const partnerPassword = await bcrypt.hash('partner123', 10)
    const partnerUser = await prisma.user.create({
      data: {
        email: 'partner@example.com',
        password: partnerPassword,
        name: '夥伴用戶',
        role: 'PARTNER',
        phone: '0934567890',
        birthday: new Date('1992-01-01'),
      },
    })

    // 創建夥伴資料
    const partner = await prisma.partner.create({
      data: {
        userId: partnerUser.id,
        name: '專業陪玩師',
        birthday: new Date('1992-01-01'),
        phone: '0934567890',
        coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
        images: [
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'
        ],
        games: ['英雄聯盟', '傳說對決', '王者榮耀'],
        halfHourlyRate: 500,
        isAvailableNow: true,
        isRankBooster: true,
        status: 'APPROVED',
        customerMessage: '專業陪玩，讓您享受遊戲樂趣！',
      },
    })

    // 為夥伴創建一些排程
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      
      // 創建上午時段
      await prisma.schedule.create({
        data: {
          partnerId: partner.id,
          date: date,
          startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0),
          endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
          isAvailable: true,
        },
      })

      // 創建下午時段
      await prisma.schedule.create({
        data: {
          partnerId: partner.id,
          date: date,
          startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 14, 0, 0),
          endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0, 0),
          isAvailable: true,
        },
      })
    }

    // 創建客戶資料
    const customer1 = await prisma.customer.create({
      data: {
        userId: user1.id,
        name: '測試用戶1',
        birthday: new Date('1995-01-01'),
        phone: '0912345678',
      },
    })

    const customer2 = await prisma.customer.create({
      data: {
        userId: user2.id,
        name: '測試用戶2',
        birthday: new Date('1998-01-01'),
        phone: '0923456789',
      },
    })

    // 獲取最終統計
    const finalStats = await DatabaseManager.getStatistics()

    return NextResponse.json({
      message: '測試資料創建成功',
      data: {
        admin: { email: admin.email, password: 'admin123' },
        users: [
          { email: user1.email, password: 'user123' },
          { email: user2.email, password: 'user123' }
        ],
        partner: { email: partnerUser.email, password: 'partner123' },
        customers: [customer1.name, customer2.name],
        schedules: '已創建未來7天的排程',
        statistics: finalStats
      }
    })
  } catch (error) {
    console.error('Error creating seed data:', error)
    return NextResponse.json(
      { error: '創建測試資料失敗', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 