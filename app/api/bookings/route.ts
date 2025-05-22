import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const data = await request.json()
    const { name, birthday, phone, partnerId, date, startTime, email, password } = data

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

    let booking;
    let customer;
    if (session?.user?.id) {
      // 已登入用戶
      customer = await prisma.customer.findUnique({
        where: { userId: session.user.id },
      });
      if (!customer) {
        // 先建立 customer
        customer = await prisma.customer.create({
          data: {
            name,
            birthday: new Date(birthday),
            phone,
            user: { connect: { id: session.user.id } },
          },
        });
      }
      booking = await prisma.booking.create({
        data: {
          scheduleId: schedule.id,
          customerId: customer.id,
          status: 'PENDING',
        },
      });
    } else {
      // 新用戶
      if (!email || !password) {
        return NextResponse.json(
          { error: '新用戶預約請提供 email 與 password' },
          { status: 400 }
        );
      }
      // 1. 建立 User
      const newUser = await prisma.user.create({
        data: {
          email,
          password,
          name,
          birthday: new Date(birthday),
          phone,
          role: 'CUSTOMER' as const,
        },
      });
      // 2. 建立 Customer
      customer = await prisma.customer.create({
        data: {
          name,
          birthday: new Date(birthday),
          phone,
          user: { connect: { id: newUser.id } },
        },
      });
      // 3. 建立 Booking
      booking = await prisma.booking.create({
        data: {
          scheduleId: schedule.id,
          customerId: customer.id,
          status: 'PENDING',
        },
      });
    }

    // 新增消費紀錄（Order），金額預設 300 元
    await prisma.order.create({
      data: {
        customerId: customer.id,
        bookingId: booking.id,
        amount: 300,
      },
    });

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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 取得查詢參數
    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId')
    const status = searchParams.get('status')
    const date = searchParams.get('date')

    // 1. 管理員查詢所有預約
    if (session.user.role === 'ADMIN') {
      const where: Record<string, unknown> = {}
      if (partnerId) {
        where.schedule = { partnerId }
      }
      if (status) {
        where.status = status
      }
      if (date) {
        // 查詢該日期的預約（根據 schedule.date）
        where.schedule = { ...(where.schedule || {}), date: new Date(date) }
      }
      const bookings = await prisma.booking.findMany({
        where,
        include: {
          schedule: { include: { partner: true } },
          customer: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ bookings })
    }

    // 2. 查詢目前登入用戶（個人）
    const customer = await prisma.customer.findFirst({ where: { userId: session.user.id } })
    if (customer) {
      const where: Record<string, unknown> = { customerId: customer.id }
      if (status) where.status = status
      if (partnerId) where.schedule = { partnerId }
      if (date) where.schedule = { ...(where.schedule || {}), date: new Date(date) }
      const bookings = await prisma.booking.findMany({
        where,
        include: {
          schedule: { include: { partner: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ bookings })
    }

    // 3. 查詢特定夥伴的預約（如果是夥伴本人）
    const partner = await prisma.partner.findFirst({ where: { userId: session.user.id } })
    if (partner) {
      const where: Record<string, unknown> = { schedule: { partnerId: partner.id } }
      if (status) where.status = status
      if (date) where.schedule = { ...(where.schedule || {}), date: new Date(date) }
      const bookings = await prisma.booking.findMany({
        where,
        include: {
          schedule: { include: { partner: true } },
          customer: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ bookings })
    }

    return NextResponse.json({ error: 'No permission or not found' }, { status: 403 })
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 