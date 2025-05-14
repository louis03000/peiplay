import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { name, birthday, phone, partnerId, date, startTime, duration } = data

    // 檢查時段是否可用
    const schedule = await prisma.schedule.findFirst({
      where: {
        partnerId,
        date: new Date(date),
        startTime,
        isAvailable: true,
      },
    })

    if (!schedule) {
      return NextResponse.json(
        { error: '所選時段不可用' },
        { status: 400 }
      )
    }

    // 計算結束時間
    const [hours, minutes] = startTime.split(':').map(Number)
    const endTime = new Date(new Date(date).setHours(hours + duration, minutes))
    const endTimeString = endTime.toTimeString().slice(0, 5)

    // 創建預約
    const booking = await prisma.booking.create({
      data: {
        scheduleId: schedule.id,
        customer: {
          create: {
            name,
            birthday: new Date(birthday),
            phone,
          },
        },
        status: 'pending',
      },
    })

    // 更新時段狀態
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { isAvailable: false },
    })

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: '創建預約失敗' },
      { status: 500 }
    )
  }
} 