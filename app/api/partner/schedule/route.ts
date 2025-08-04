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
  const partner = await prisma.partner.findUnique({ where: { userId } })
  if (!partner) return NextResponse.json({ error: '不是夥伴' }, { status: 403 })

  // 過濾有效時段
  const validSchedules = schedules.filter(schedule => schedule.date && schedule.startTime && schedule.endTime)
  if (validSchedules.length === 0) {
    return NextResponse.json({ error: '沒有有效的時段數據' }, { status: 400 })
  }

  // 檢查重複
  const existing = await prisma.schedule.findMany({
    where: {
      partnerId: partner.id,
      OR: validSchedules.map(s => ({
        date: new Date(s.date),
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
      })),
    }
  })
  if (existing.length > 0) {
    return NextResponse.json({ error: '有重複的時段', details: existing }, { status: 409 })
  }

  // 批量插入
  try {
    const result = await prisma.schedule.createMany({
      data: validSchedules.map(s => ({
        partnerId: partner.id,
        date: new Date(s.date),
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
        isAvailable: true,
      })),
      skipDuplicates: true,
    })
    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '批量創建時段失敗' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
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
      booked: s.bookings ? (s.bookings.status === 'CONFIRMED' || s.bookings.status === 'PENDING') : false,
    }))
    // 新增 debug log
    console.log('[GET /api/partner/schedule]', {
      userId: session.user.id,
      partnerId: partner.id,
      schedulesLength: schedules.length,
      schedules: schedules.map(s => ({ id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime }))
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/partner/schedule error:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Internal Server Error') }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } })
  if (!partner) return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
  const body = await request.json()
  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: '請傳入要刪除的時段陣列' }, { status: 400 })
  }
  // 只允許刪除未被預約的時段
  const schedules = await prisma.schedule.findMany({
    where: {
      partnerId: partner.id,
      OR: body.map(s => ({
        date: new Date(s.date),
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
      })),
    },
    include: { bookings: true },
  })
  const deletable = schedules.filter(s => !s.bookings || (s.bookings.status !== 'CONFIRMED' && s.bookings.status !== 'PENDING'))
  const ids = deletable.map(s => s.id)
  if (ids.length === 0) {
    return NextResponse.json({ error: '沒有可刪除的時段（可能已被預約）' }, { status: 409 })
  }
  await prisma.schedule.deleteMany({ where: { id: { in: ids } } })
  return NextResponse.json({ success: true, count: ids.length })
} 