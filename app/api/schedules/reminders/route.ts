import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addHours } from 'date-fns'

interface Reminder {
  scheduleId: string
  bookingId: string
  customerName: string
  customerPhone: string
  date: string
  startTime: string
  endTime: string
  hoursUntilStart: number
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

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
    const reminderWindow = {
      start: now,
      end: addHours(now, 24), // 未來 24 小時內的時段
    }

    // 獲取需要提醒的時段
    const schedules = await prisma.schedule.findMany({
      where: {
        partnerId: partner.id,
        date: {
          gte: reminderWindow.start,
          lte: reminderWindow.end,
        },
        bookings: {
          some: {
            status: 'CONFIRMED',
          },
        },
      },
      include: {
        bookings: {
          include: {
            customer: true,
          },
        },
      },
    })

    // 過濾出需要提醒的時段
    const reminders = schedules
      .map((schedule): Reminder | null => {
        const booking = schedule.bookings[0]
        if (!booking) return null

        const scheduleTime = new Date(
          `${schedule.date}T${schedule.startTime}`
        )
        const hoursUntilStart = Math.round(
          (scheduleTime.getTime() - now.getTime()) / (1000 * 60 * 60)
        )

        // 只返回未來 24 小時內的時段
        if (hoursUntilStart < 0 || hoursUntilStart > 24) {
          return null
        }

        return {
          scheduleId: schedule.id,
          bookingId: booking.id,
          customerName: booking.customer.name,
          customerPhone: booking.customer.phone,
          date: schedule.date instanceof Date ? schedule.date.toISOString() : schedule.date,
          startTime: schedule.startTime instanceof Date ? schedule.startTime.toISOString() : schedule.startTime,
          endTime: schedule.endTime instanceof Date ? schedule.endTime.toISOString() : schedule.endTime,
          hoursUntilStart,
        }
      })
      .filter((reminder): reminder is Reminder => reminder !== null)

    return NextResponse.json({ reminders })
  } catch (error) {
    console.error('Error getting schedule reminders:', error)
    return NextResponse.json(
      { error: '獲取時段提醒失敗' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { scheduleId, bookingId, reminderSent } = await request.json()

    if (!scheduleId || !bookingId || typeof reminderSent !== 'boolean') {
      return NextResponse.json(
        { error: '無效的請求數據' },
        { status: 400 }
      )
    }

    // 更新提醒狀態
    await prisma.booking.update({
      where: {
        id: bookingId,
      },
      data: {
        reminderSent,
      },
    })

    return NextResponse.json({ message: '更新提醒狀態成功' })
  } catch (error) {
    console.error('Error updating reminder status:', error)
    return NextResponse.json(
      { error: '更新提醒狀態失敗' },
      { status: 500 }
    )
  }
} 