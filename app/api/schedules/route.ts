import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const partnerId = searchParams.get('partnerId')

    const where = {
      ...(startDate && endDate
        ? {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }
        : {}),
      ...(partnerId ? { partnerId } : {}),
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        partner: {
          select: {
            name: true,
            games: true,
            halfHourlyRate: true,
          },
        },
        bookings: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json(
      { error: '獲取時段失敗' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const data = await request.json()
    const { date, startTime, endTime, isRecurring, recurringWeeks } = data

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

    // 檢查時段衝突
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        partnerId: partner.id,
        date: new Date(date),
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
        ],
      },
    })

    if (existingSchedules.length > 0) {
      return NextResponse.json(
        { error: '時段與現有時段衝突' },
        { status: 400 }
      )
    }

    // 創建時段
    const schedule = await prisma.schedule.create({
      data: {
        partnerId: partner.id,
        date: new Date(date),
        startTime,
        endTime,
        isAvailable: true,
      },
    })

    // 如果是重複時段，創建後續的時段
    if (isRecurring && recurringWeeks > 1) {
      const recurringSchedules = []
      for (let i = 1; i < recurringWeeks; i++) {
        const nextDate = new Date(date)
        nextDate.setDate(nextDate.getDate() + i * 7)
        recurringSchedules.push({
          partnerId: partner.id,
          date: nextDate,
          startTime,
          endTime,
          isAvailable: true,
        })
      }
      await prisma.schedule.createMany({
        data: recurringSchedules,
      })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error creating schedule:', error)
    return NextResponse.json(
      { error: '創建時段失敗' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const data = await request.json()
    const { id, date, startTime, endTime } = data

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

    // 檢查時段是否存在且屬於當前用戶
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        id,
        partnerId: partner.id,
      },
    })

    if (!existingSchedule) {
      return NextResponse.json(
        { error: '找不到時段' },
        { status: 404 }
      )
    }

    // 檢查時段衝突
    const conflictingSchedules = await prisma.schedule.findMany({
      where: {
        partnerId: partner.id,
        date: new Date(date),
        id: { not: id },
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
        ],
      },
    })

    if (conflictingSchedules.length > 0) {
      return NextResponse.json(
        { error: '時段與現有時段衝突' },
        { status: 400 }
      )
    }

    // 更新時段
    const updatedSchedule = await prisma.schedule.update({
      where: { id },
      data: {
        date: new Date(date),
        startTime,
        endTime,
      },
    })

    return NextResponse.json(updatedSchedule)
  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json(
      { error: '更新時段失敗' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少時段ID' },
        { status: 400 }
      )
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

    // 檢查時段是否存在且屬於當前用戶
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        id,
        partnerId: partner.id,
      },
    })

    if (!existingSchedule) {
      return NextResponse.json(
        { error: '找不到時段' },
        { status: 404 }
      )
    }

    // 刪除時段
    await prisma.schedule.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      { error: '刪除時段失敗' },
      { status: 500 }
    )
  }
} 