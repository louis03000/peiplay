import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { parseTaipeiDateTime } from '@/lib/time-utils'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const payload = await request.json()

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      if (Array.isArray(payload)) {
        const schedules = payload.filter((s) => s?.date && s?.startTime && s?.endTime)
        if (schedules.length === 0) {
          return { type: 'INVALID_BODY' } as const
        }

        const existing = await client.schedule.findMany({
          where: {
            partnerId: partner.id,
            OR: schedules.map((s) => ({
              date: parseTaipeiDateTime(s.date),
              startTime: parseTaipeiDateTime(s.startTime),
              endTime: parseTaipeiDateTime(s.endTime),
            })),
          },
        })

        if (existing.length > 0) {
          return { type: 'DUPLICATED', details: existing } as const
        }

        const created = await client.schedule.createMany({
          data: schedules.map((s) => ({
            partnerId: partner.id,
            date: parseTaipeiDateTime(s.date),
            startTime: parseTaipeiDateTime(s.startTime),
            endTime: parseTaipeiDateTime(s.endTime),
            isAvailable: true,
          })),
          skipDuplicates: true,
        })

        return { type: 'BATCH_SUCCESS', count: created.count } as const
      }

      const { date, startTime, endTime } = payload
      if (!date || !startTime || !endTime) {
        return { type: 'INVALID_BODY' } as const
      }

      const existingSchedule = await client.schedule.findFirst({
        where: {
          partnerId: partner.id,
          date: parseTaipeiDateTime(date),
          startTime: parseTaipeiDateTime(startTime),
          endTime: parseTaipeiDateTime(endTime),
        },
      })

      if (existingSchedule) {
        return { type: 'DUPLICATED' } as const
      }

      const schedule = await client.schedule.create({
        data: {
          partnerId: partner.id,
          date: parseTaipeiDateTime(date),
          startTime: parseTaipeiDateTime(startTime),
          endTime: parseTaipeiDateTime(endTime),
          isAvailable: true,
        },
      })

      return { type: 'SINGLE_SUCCESS', schedule } as const
    }, 'partner:schedule:create')

    switch (result.type) {
      case 'NOT_PARTNER':
        return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
      case 'INVALID_BODY':
        return NextResponse.json({ error: '沒有有效的時段數據' }, { status: 400 })
      case 'DUPLICATED':
        return NextResponse.json({ error: '該時段已存在，不可重複新增', details: result.details }, { status: 409 })
      case 'BATCH_SUCCESS':
        return NextResponse.json({ success: true, count: result.count })
      case 'SINGLE_SUCCESS':
        return NextResponse.json(result.schedule)
      default:
        return NextResponse.json({ error: '未知狀態' }, { status: 500 })
    }
  } catch (error) {
    return createErrorResponse(error, 'partner:schedule:create')
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          schedules: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              isAvailable: true,
              bookings: {
                select: { status: true },
              },
            },
            orderBy: { date: 'asc' },
          },
        },
      })

      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      const schedules = partner.schedules.map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        isAvailable: s.isAvailable,
        booked: Boolean(s.bookings?.status && !['CANCELLED', 'REJECTED'].includes(s.bookings.status as string)),
      }))

      return { type: 'SUCCESS', schedules } as const
    }, 'partner:schedule:get')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
    }

    return NextResponse.json(result.schedules)
  } catch (error) {
    return createErrorResponse(error, 'partner:schedule:get')
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const payload = await request.json()

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      if (!Array.isArray(payload) || payload.length === 0) {
        return { type: 'INVALID_BODY' } as const
      }

      const schedules = await client.schedule.findMany({
        where: {
          partnerId: partner.id,
          OR: payload.map((s) => ({
            date: parseTaipeiDateTime(s.date),
            startTime: parseTaipeiDateTime(s.startTime),
            endTime: parseTaipeiDateTime(s.endTime),
          })),
        },
        include: { bookings: true },
      })

      const deletable = schedules.filter(
        (s) => !s.bookings || !['CONFIRMED', 'PENDING'].includes(String(s.bookings.status))
      )

      if (deletable.length === 0) {
        return { type: 'NO_DELETABLE' } as const
      }

      const ids = deletable.map((s) => s.id)
      const deleted = await client.schedule.deleteMany({ where: { id: { in: ids } } })

      return { type: 'SUCCESS', count: deleted.count }
    }, 'partner:schedule:delete')

    switch (result.type) {
      case 'NOT_PARTNER':
        return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
      case 'INVALID_BODY':
        return NextResponse.json({ error: '請傳入要刪除的時段陣列' }, { status: 400 })
      case 'NO_DELETABLE':
        return NextResponse.json({ error: '沒有可刪除的時段（可能已被預約）' }, { status: 409 })
      case 'SUCCESS':
        return NextResponse.json({ success: true, count: result.count })
      default:
        return NextResponse.json({ error: '未知狀態' }, { status: 500 })
    }
  } catch (error) {
    return createErrorResponse(error, 'partner:schedule:delete')
  }
} 