import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    // 獲取夥伴資料
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      include: {
        schedules: {
          where: {
            date: {
              gte: new Date()
            }
          },
          orderBy: {
            date: 'asc'
          }
        }
      }
    })

    if (!partner) {
      return NextResponse.json({ error: '找不到夥伴資料' }, { status: 404 })
    }

    // 計算統計資料
    const totalSchedules = partner.schedules.length
    const availableSchedules = partner.schedules.filter(s => s.isAvailable).length
    const futureSchedules = partner.schedules.filter(s => new Date(s.date) > new Date()).length

    return NextResponse.json({
      partner: {
        id: partner.id,
        name: partner.name,
        status: partner.status,
        isAvailableNow: partner.isAvailableNow,
        isRankBooster: partner.isRankBooster,
        games: partner.games,
        halfHourlyRate: partner.halfHourlyRate
      },
      schedules: {
        total: totalSchedules,
        available: availableSchedules,
        future: futureSchedules,
        details: partner.schedules.map(s => ({
          id: s.id,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          isAvailable: s.isAvailable,
          isFuture: new Date(s.date) > new Date()
        }))
      }
    })
  } catch (error) {
    console.error('Debug partner error:', error)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
} 