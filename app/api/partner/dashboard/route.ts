import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log('🚀 Partner dashboard API triggered');
  try {
    const session = await getServerSession(authOptions)
    console.log('📝 Session check:', session?.user?.id ? 'User logged in' : 'No user session');
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }
    
    // 一次性獲取所有需要的數據
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        isAvailableNow: true,
        isRankBooster: true,
        allowGroupBooking: true,
        availableNowSince: true,
        rankBoosterImages: true,
        schedules: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            isAvailable: true,
            bookings: {
              select: {
                status: true
              }
            }
          },
          orderBy: { date: 'asc' }
        },
        groupBookings: {
          select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            pricePerPerson: true,
            maxParticipants: true,
            currentParticipants: true,
            status: true
          },
          orderBy: { startTime: 'asc' }
        }
      }
    })
    
    if (!partner) {
      return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
    }
    
    // 處理時段數據
    const schedules = partner.schedules.map(s => ({
      ...s,
      booked: s.bookings && s.bookings.status && !['CANCELLED', 'REJECTED'].includes(s.bookings.status)
    }))
    
    // 返回所有數據
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
      groups: partner.groupBookings
    })
  } catch (error) {
    console.error('Partner dashboard GET error:', error)
    
    return NextResponse.json({ 
      error: 'Internal Server Error',
      partner: null,
      schedules: [],
      groups: []
    }, { status: 500 })
  } finally {
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('Database disconnect error:', disconnectError)
    }
  }
}
