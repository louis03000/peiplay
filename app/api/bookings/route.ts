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

    // 計算結束時間
    const [hours, minutes] = startTime.split(':').map(Number)
    const endTime = new Date(new Date(date).setHours(hours + duration, minutes))

    let booking;
    if (session?.user?.id) {
      // 已登入用戶
      let customer = await prisma.customer.findUnique({
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
      booking = await prisma.booking.create({
        data: {
          scheduleId: schedule.id,
          customer: {
            create: {
              name,
              birthday: new Date(birthday),
              phone,
              user: {
                create: {
                  email,
                  password,
                  name,
                  birthday: new Date(birthday),
                  phone,
                  role: 'CUSTOMER' as any,
                },
              },
            },
          } as any,
          status: 'PENDING',
        },
      });
    }

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