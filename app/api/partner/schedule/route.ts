import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }
  const { date, startTime, endTime } = await request.json()
  // 取得 partnerId
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } })
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
  })
  return NextResponse.json(schedules)
} 