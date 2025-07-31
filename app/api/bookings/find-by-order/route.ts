import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderNumber } = body

    if (!orderNumber) {
      return NextResponse.json(
        { error: '缺少訂單編號' },
        { status: 400 }
      )
    }

    // 查找對應的預約
    const booking = await prisma.booking.findFirst({
      where: {
        orderNumber: orderNumber
      },
      include: {
        partner: true,
        schedules: true
      }
    })

    if (!booking) {
      return NextResponse.json(
        { error: '找不到對應的預約' },
        { status: 404 }
      )
    }

    return NextResponse.json(booking)

  } catch (error) {
    console.error('Error finding booking by order number:', error)
    return NextResponse.json(
      { error: '查找預約失敗' },
      { status: 500 }
    )
  }
} 