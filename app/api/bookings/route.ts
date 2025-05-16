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

    let customerConnectOrCreate
    if (session?.user?.id) {
      // 已登入用戶，直接 connect
      const customer = await prisma.customer.findUnique({
        where: { userId: session.user.id },
      })
      if (!customer) {
        // 若沒有 customer 資料，則建立
        customerConnectOrCreate = {
          create: {
            name,
            birthday: new Date(birthday),
            phone,
            user: { connect: { id: session.user.id } },
          },
        }
      } else {
        customerConnectOrCreate = { connect: { id: customer.id } }
      }
    } else {
      // 新用戶，建立 User + Customer
      if (!email || !password) {
        return NextResponse.json(
          { error: '新用戶預約請提供 email 與 password' },
          { status: 400 }
        )
      }
      customerConnectOrCreate = {
        create: {
          name,
          birthday: new Date(birthday),
          phone,
          user: {
            create: {
              email,
              password, // 請注意：這裡建議 hash 密碼，或前端先 hash
              name,
              birthday: new Date(birthday),
              phone,
              role: 'CUSTOMER' as any,
            },
          },
        },
      }
    }

    // 創建預約
    const booking = await prisma.booking.create({
      data: {
        scheduleId: schedule.id,
        customer: customerConnectOrCreate,
        status: 'PENDING',
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