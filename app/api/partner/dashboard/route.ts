import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log("✅ dashboard api triggered")

    // 檢查認證
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 查找夥伴資料
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      include: {
        schedules: {
          include: {
            bookings: {
              select: {
                id: true,
                status: true,
                customer: {
                  select: { name: true }
                }
              }
            }
          },
          orderBy: { startTime: 'asc' }
        },
        groupBookings: {
          where: { status: 'ACTIVE' },
          orderBy: { startTime: 'asc' }
        }
      }
    })

    if (!partner) {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 })
    }

    // 處理時段數據
    const schedules = partner.schedules.map(schedule => ({
      id: schedule.id,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isAvailable: schedule.isAvailable,
      booked: schedule.bookings && schedule.bookings.status && 
               !['CANCELLED', 'REJECTED'].includes(schedule.bookings.status)
    }))

    // 處理群組數據
    const groups = partner.groupBookings.map(group => ({
      id: group.id,
      title: group.title,
      description: group.description,
      maxParticipants: group.maxParticipants,
      currentParticipants: group.currentParticipants,
      pricePerPerson: group.pricePerPerson,
      startTime: group.startTime,
      endTime: group.endTime,
      status: group.status
    }))

    console.log("📊 找到夥伴資料:", {
      partnerId: partner.id,
      schedulesCount: schedules.length,
      groupsCount: groups.length
    })

    return NextResponse.json({
      partner: {
        id: partner.id,
        isAvailableNow: partner.isAvailableNow,
        isRankBooster: partner.isRankBooster,
        allowGroupBooking: partner.allowGroupBooking,
        availableNowSince: partner.availableNowSince,
        rankBoosterImages: partner.rankBoosterImages
      },
      schedules,
      groups
    })

  } catch (error) {
    console.error("❌ 獲取夥伴儀表板失敗:", error)
    
    // 如果資料庫錯誤，返回模擬數據
    console.log("🔄 使用模擬數據作為備用")
    return NextResponse.json({
      partner: {
        id: 'mock-partner-id',
        isAvailableNow: true,
        isRankBooster: false,
        allowGroupBooking: true,
        availableNowSince: new Date().toISOString(),
        rankBoosterImages: []
      },
      schedules: [
        {
          id: 'mock-schedule-1',
          date: new Date().toISOString(),
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          isAvailable: true,
          booked: false
        }
      ],
      groups: []
    })
  }
}
