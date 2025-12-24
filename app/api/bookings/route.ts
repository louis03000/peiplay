/**
 * Bookings API Route
 * 
 * 已遷移到使用 Booking Service
 * 遵循架構隔離原則：API route 只負責解析 request 和回傳 response
 */

import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { withApiGuard, validateMethod, validateJsonBody } from '@/lib/api-guard'
import { createBooking } from '@/services/booking/booking.service'
import { BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Handles the creation of new bookings.
 */
async function POSTHandler(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 })
  }

  // 驗證請求體
  const bodyResult = await validateJsonBody<{ scheduleIds: string[] }>(request)
  if (!bodyResult.valid) {
    return bodyResult.error
  }

  const { scheduleIds } = bodyResult.data

  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    return NextResponse.json({ error: 'Valid schedule IDs were not provided' }, { status: 400 })
  }

  // 獲取客戶 ID
  const { db } = await import('@/lib/db-resilience')
  const customer = await db.query(async (client) => {
    return client.customer.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
  }, 'bookings:get-customer')

  if (!customer) {
    return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
  }

  // 呼叫 Service
  const result = await createBooking({
    scheduleIds,
    customerId: customer.id,
  })

  // 處理 Service 結果
  if (!result.success) {
    const statusCode = result.error.type === 'CONFLICT' ? 409 : 
                      result.error.type === 'NO_CUSTOMER' || result.error.type === 'INVALID_SCHEDULE' ? 404 : 400
    
    return NextResponse.json(
      { 
        error: result.error.message,
        code: result.error.type,
        ...(result.error.type === 'CONFLICT' && 'conflictingScheduleId' in result.error 
          ? { conflictingScheduleId: result.error.conflictingScheduleId } 
          : {}),
      },
      { status: statusCode }
    )
  }

  // 返回成功響應
  return NextResponse.json({
    bookings: result.data.map((booking) => ({
      id: booking.id,
      status: booking.status,
      message: '預約創建成功，已通知夥伴',
    })),
  })
}

/**
 * Fetches bookings based on the user's role.
 */
async function GETHandler(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 })
  }

  const { db } = await import('@/lib/db-resilience')
  const bookings = await db.query(async (client) => {
    const customer = await client.customer.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!customer) {
      return null
    }

    return client.booking.findMany({
      where: { customerId: customer.id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        schedule: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            partner: {
              select: { 
                name: true,
                id: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    })
  }, 'bookings:list')

  if (bookings === null) {
    return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
  }

  return NextResponse.json({ bookings })
}

// 使用 API Guard 包裝
export const POST = withApiGuard(POSTHandler)
export const GET = withApiGuard(GETHandler)
