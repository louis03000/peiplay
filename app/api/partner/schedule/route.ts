import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }
  
  const body = await request.json()
  
  // 檢查是否為批量請求
  if (Array.isArray(body)) {
    return handleBatchCreate(body, session.user.id)
  } else {
    return handleSingleCreate(body, session.user.id)
  }
}

async function handleSingleCreate(data: any, userId: string) {
  const { date, startTime, endTime } = data
  
  // 取得 partnerId
  const partner = await prisma.partner.findUnique({ where: { userId } })
  if (!partner) return NextResponse.json({ error: '不是夥伴' }, { status: 403 })

  // 檢查時段是否已存在
  const existingSchedule = await prisma.schedule.findFirst({
    where: {
      partnerId: partner.id,
      date: new Date(date),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    },
  });

  if (existingSchedule) {
    return NextResponse.json({ error: '該時段已存在，不可重複新增' }, { status: 409 }); // 409 Conflict
  }

  const schedule = await prisma.schedule.create({
    data: {
      partnerId: partner.id,
      date: new Date(date),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      isAvailable: true,
    }
  })
  return NextResponse.json(schedule)
}

async function handleBatchCreate(schedules: any[], userId: string) {
  // 取得 partnerId
  const partner = await prisma.partner.findUnique({ where: { userId } })
  if (!partner) return NextResponse.json({ error: '不是夥伴' }, { status: 403 })

  // 驗證所有時段數據
  const validSchedules = schedules.filter(schedule => {
    return schedule.date && schedule.startTime && schedule.endTime
  })

  if (validSchedules.length === 0) {
    return NextResponse.json({ error: '沒有有效的時段數據' }, { status: 400 })
  }

  try {
    // 使用事務來確保數據一致性
    const results = await prisma.$transaction(async (tx) => {
      const createdSchedules = []
      const errors = []

      for (const scheduleData of validSchedules) {
        try {
          // 檢查時段是否已存在
          const existingSchedule = await tx.schedule.findFirst({
            where: {
              partnerId: partner.id,
              date: new Date(scheduleData.date),
              startTime: new Date(scheduleData.startTime),
              endTime: new Date(scheduleData.endTime),
            },
          });

          if (existingSchedule) {
            errors.push({ 
              schedule: scheduleData, 
              error: '該時段已存在，不可重複新增' 
            })
            continue
          }

          const schedule = await tx.schedule.create({
            data: {
              partnerId: partner.id,
              date: new Date(scheduleData.date),
              startTime: new Date(scheduleData.startTime),
              endTime: new Date(scheduleData.endTime),
              isAvailable: true,
            }
          })
          createdSchedules.push(schedule)
        } catch (error) {
          errors.push({ 
            schedule: scheduleData, 
            error: error instanceof Error ? error.message : '創建失敗' 
          })
        }
      }

      return { createdSchedules, errors }
    })

    return NextResponse.json({
      success: true,
      created: results.createdSchedules.length,
      errors: results.errors.length,
      details: results
    })
  } catch (error) {
    console.error('批量創建時段失敗:', error)
    return NextResponse.json({ error: '批量創建時段失敗' }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } })
  if (!partner) return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
  const schedules = await prisma.schedule.findMany({
    where: { partnerId: partner.id },
    orderBy: { date: 'asc' },
    include: {
      bookings: true,
    },
  })
  // 加上 booked 屬性
  const result = schedules.map(s => ({
    ...s,
    booked: s.bookings.some(b => b.status === 'CONFIRMED' || b.status === 'PENDING'),
  }))
  return NextResponse.json(result)
} 