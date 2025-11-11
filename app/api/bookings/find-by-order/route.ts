import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic';

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

    const booking = await db.query(async (client) => {
      return client.booking.findFirst({
        where: { orderNumber },
        include: {
          schedule: {
            include: {
              partner: true,
            },
          },
        },
      })
    }, 'bookings:find-by-order')

    if (!booking) {
      return NextResponse.json(
        { error: '找不到對應的預約' },
        { status: 404 }
      )
    }

    return NextResponse.json(booking)
  } catch (error) {
    return createErrorResponse(error, 'bookings:find-by-order')
  }
} 