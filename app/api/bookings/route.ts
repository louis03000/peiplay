import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const data = await request.json()
    const { name, birthday, phone, partnerId, date, startTime, duration, email, password } = data

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customer = await prisma.customer.findFirst({
      where: {
        user: {
          email: session.user.email
        }
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const bookings = await prisma.booking.findMany({
      where: {
        customerId: customer.id
      },
      include: {
        schedule: {
          include: {
            partner: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ bookings })
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 