export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { startOfWeek, endOfWeek, subWeeks } from 'date-fns'

interface ScheduleWithBookings {
  id: string
  date: Date
  startTime: Date
  endTime: Date
  bookings: {
    id: string
    status: string
  } | null
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weeks = parseInt(searchParams.get('weeks') || '4')

    // 獲取當前用戶的 partner 信息
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    })

    if (!partner) {
      return NextResponse.json(
        { error: '找不到夥伴信息' },
        { status: 404 }
      )
    }

    const now = new Date()
    const startDate = startOfWeek(subWeeks(now, weeks - 1))
    const endDate = endOfWeek(now)

    // 獲取時段統計數據
    const schedules = await prisma.schedule.findMany({
      where: {
        partnerId: partner.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        bookings: true,
      },
    }) as ScheduleWithBookings[]

    // 計算使用率
    const totalSlots = schedules.length
    const bookedSlots = schedules.filter(
      (schedule) => schedule.bookings !== null
    ).length
    const utilizationRate = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0

    // 計算熱門時段
    const timeSlots = schedules.reduce<Record<string, number>>((acc, schedule) => {
      const timeSlot = `${schedule.startTime instanceof Date ? schedule.startTime.toISOString() : schedule.startTime}-${schedule.endTime instanceof Date ? schedule.endTime.toISOString() : schedule.endTime}`
      acc[timeSlot] = (acc[timeSlot] || 0) + 1
      return acc
    }, {})

    const popularTimeSlots = Object.entries(timeSlots)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([timeSlot, count]) => ({
        timeSlot,
        count,
      }))

    // 計算每週使用率
    const weeklyStats = Array.from({ length: weeks }, (_, i) => {
      const weekStart = startOfWeek(subWeeks(now, i))
      const weekEnd = endOfWeek(weekStart)
      const weekSchedules = schedules.filter(
        (schedule) =>
          new Date(schedule.date) >= weekStart &&
          new Date(schedule.date) <= weekEnd
      )
      const weekTotalSlots = weekSchedules.length
      const weekBookedSlots = weekSchedules.filter(
        (schedule) => schedule.bookings !== null
      ).length
      const weekUtilizationRate =
        weekTotalSlots > 0 ? (weekBookedSlots / weekTotalSlots) * 100 : 0

      return {
        week: i + 1,
        startDate: weekStart,
        endDate: weekEnd,
        totalSlots: weekTotalSlots,
        bookedSlots: weekBookedSlots,
        utilizationRate: weekUtilizationRate,
      }
    })

    return NextResponse.json({
      overallStats: {
        totalSlots,
        bookedSlots,
        utilizationRate,
      },
      popularTimeSlots,
      weeklyStats,
    })
  } catch (error) {
    console.error('Error getting schedule stats:', error)
    return NextResponse.json(
      { error: '獲取時段統計失敗' },
      { status: 500 }
    )
  }
} 