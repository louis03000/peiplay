import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      const groupBookings = await client.groupBooking.findMany({
        where: {
          initiatorId: partner.id,
          initiatorType: 'PARTNER',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          title: true,
          description: true,
          maxParticipants: true,
          pricePerPerson: true,
          status: true,
          games: true,
          startTime: true,
          endTime: true,
          _count: {
            select: { GroupBookingParticipant: true },
          },
        },
        orderBy: { startTime: 'asc' },
      })

      const groups = groupBookings.map((group) => ({
        id: group.id,
        title: group.title,
        description: group.description,
        maxParticipants: group.maxParticipants,
        currentParticipants: group._count.GroupBookingParticipant,
        pricePerPerson: group.pricePerPerson,
        status: group.status,
        games: group.games || [],
        startTime: group.startTime instanceof Date ? group.startTime.toISOString() : group.startTime,
        endTime: group.endTime instanceof Date ? group.endTime.toISOString() : group.endTime,
      }))

      return { type: 'SUCCESS', groups }
    }, 'partner:groups:get')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 })
    }

    return NextResponse.json(result.groups)
  } catch (error) {
    return createErrorResponse(error, 'partner:groups:get')
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const data = await request.json()
    if (!data.title || !data.date || !data.startTime || !data.endTime || !data.pricePerPerson) {
      return NextResponse.json({
        error: '缺少必要欄位',
        details: '請填寫群組標題、日期、開始時間、結束時間和每人費用',
      }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      const user = await client.user.findUnique({ where: { id: session.user.id } })
      if (!user) {
        return { type: 'USER_NOT_FOUND' } as const
      }

      let customer = await client.customer.findUnique({ where: { userId: session.user.id } })
      if (!customer) {
        customer = await client.customer.create({
          data: {
            id: `customer-${session.user.id}`,
            userId: session.user.id,
            name: user.name || '未知客戶',
            birthday: new Date('1990-01-01'),
            phone: '0000000000',
          },
        }).catch(async () => {
          return client.customer.findUnique({ where: { userId: session.user.id } })
        })

        if (!customer) {
          return { type: 'CUSTOMER_CREATE_FAILED' } as const
        }
      }

      const startTime = new Date(`${data.date}T${normalizeTime(data.startTime)}`)
      const endTime = new Date(`${data.date}T${normalizeTime(data.endTime)}`)

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return { type: 'INVALID_DATETIME' } as const
      }

      if (endTime <= startTime) {
        return { type: 'END_BEFORE_START' } as const
      }

      if (data.pricePerPerson <= 0) {
        return { type: 'INVALID_PRICE' } as const
      }

      const maxParticipants = data.maxParticipants || 4
      if (maxParticipants < 2 || maxParticipants > 9) {
        return { type: 'INVALID_PARTICIPANTS' } as const
      }

      try {
        const groupBooking = await client.groupBooking.create({
          data: {
            id: `gb-${Date.now()}`,
            type: 'PARTNER_INITIATED',
            title: data.title.trim(),
            description: data.description ? data.description.trim() : null,
            date: startTime,
            startTime,
            endTime,
            maxParticipants,
            currentParticipants: 0,
            pricePerPerson: parseFloat(data.pricePerPerson),
            status: 'ACTIVE',
            initiatorId: partner.id,
            initiatorType: 'PARTNER',
            games: Array.isArray(data.games) ? data.games.filter((g: any) => g && typeof g === 'string') : [],
          },
        })

        await client.groupBookingParticipant.create({
          data: {
            id: `gbp-${groupBooking.id}-${partner.id}`,
            groupBookingId: groupBooking.id,
            customerId: customer.id,
            partnerId: partner.id,
            status: 'ACTIVE',
          },
        })

        await client.groupBooking.update({
          where: { id: groupBooking.id },
          data: { currentParticipants: 1 },
        }).catch(() => undefined)

        await client.partner.update({
          where: { id: partner.id },
          data: { allowGroupBooking: true },
        }).catch(() => undefined)

        return {
          type: 'SUCCESS',
          group: {
            id: groupBooking.id,
            title: groupBooking.title,
            description: groupBooking.description,
            maxParticipants: groupBooking.maxParticipants,
            currentParticipants: 1,
            pricePerPerson: groupBooking.pricePerPerson,
            status: groupBooking.status,
            games: groupBooking.games || [],
            startTime: groupBooking.startTime.toISOString(),
            endTime: groupBooking.endTime.toISOString(),
          },
        }
      } catch (error: any) {
        if (error?.code === 'P2002') {
          return { type: 'DUPLICATE' } as const
        }
        throw error
      }
    }, 'partner:groups:post')

    switch (result.type) {
      case 'NOT_PARTNER':
        return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 })
      case 'USER_NOT_FOUND':
        return NextResponse.json({ error: '用戶資料不存在' }, { status: 404 })
      case 'CUSTOMER_CREATE_FAILED':
        return NextResponse.json({ error: '無法創建客戶記錄' }, { status: 500 })
      case 'INVALID_DATETIME':
        return NextResponse.json({ error: '日期時間格式錯誤' }, { status: 400 })
      case 'END_BEFORE_START':
        return NextResponse.json({ error: '結束時間必須晚於開始時間' }, { status: 400 })
      case 'INVALID_PRICE':
        return NextResponse.json({ error: '每人費用必須大於0' }, { status: 400 })
      case 'INVALID_PARTICIPANTS':
        return NextResponse.json({ error: '最大參與人數必須在2到9人之間' }, { status: 400 })
      case 'DUPLICATE':
        return NextResponse.json({ error: '群組預約ID已存在，請稍後再試' }, { status: 409 })
      case 'SUCCESS':
        return NextResponse.json({ success: true, groupBooking: result.group })
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 })
    }
  } catch (error) {
    return createErrorResponse(error, 'partner:groups:post')
  }
}

function normalizeTime(value: string) {
  if (value.includes('T')) {
    const timePart = value.split('T')[1]?.split('Z')[0]?.split('+')[0]
    value = timePart || value
  }
  const parts = value.split(':')
  if (parts.length === 2) {
    return `${value}:00`
  }
  return value
}