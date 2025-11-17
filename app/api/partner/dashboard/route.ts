import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const now = new Date()
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)
      
      // 先檢查並自動關閉超過30分鐘的「現在有空」狀態
      await client.partner.updateMany({
        where: {
          userId: session.user.id,
          isAvailableNow: true,
          availableNowSince: {
            lt: thirtyMinutesAgo
          }
        },
        data: {
          isAvailableNow: false,
          availableNowSince: null
        }
      })
      
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          isAvailableNow: true,
          isRankBooster: true,
          allowGroupBooking: true,
          availableNowSince: true,
          rankBoosterImages: true,
          games: true,
          schedules: {
            where: {
              // 只載入未來的時段或今天的時段
              OR: [
                { date: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
              ],
            },
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              isAvailable: true,
              bookings: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            take: 200, // 限制載入的時段數量
          },
        },
      })

      if (!partner) {
        return { type: 'NOT_FOUND' } as const
      }

      const schedules = partner.schedules.map((schedule) => {
        const booking = schedule.bookings
        let isBooked = false
        if (booking && booking.status) {
          const status = String(booking.status)
          isBooked = !['CANCELLED', 'REJECTED'].includes(status)
        }

        return {
          id: schedule.id,
          date: schedule.date instanceof Date ? schedule.date.toISOString() : schedule.date,
          startTime: schedule.startTime instanceof Date ? schedule.startTime.toISOString() : schedule.startTime,
          endTime: schedule.endTime instanceof Date ? schedule.endTime.toISOString() : schedule.endTime,
          isAvailable: schedule.isAvailable,
          booked: isBooked,
        }
      })

      await client.groupBooking.updateMany({
        where: {
          initiatorId: partner.id,
          initiatorType: 'PARTNER',
          status: 'ACTIVE',
          endTime: { lt: now },
        },
        data: { status: 'COMPLETED' },
      }).catch((err) => console.warn('更新已過期群組預約狀態失敗:', err))

      let groupBookings
      try {
        groupBookings = await client.groupBooking.findMany({
          where: {
            initiatorId: partner.id,
            initiatorType: 'PARTNER',
            status: 'ACTIVE',
            endTime: { gt: now },
          },
          select: {
            id: true,
            title: true,
            description: true,
            maxParticipants: true,
            pricePerPerson: true,
            startTime: true,
            endTime: true,
            status: true,
            games: true,
            _count: {
              select: {
                GroupBookingParticipant: true,
              },
            },
          },
          orderBy: { startTime: 'asc' },
        })
      } catch (error) {
        console.warn('⚠️ 查詢 games 欄位失敗，改用不包含 games 的查詢:', error)
        groupBookings = await client.groupBooking.findMany({
          where: {
            initiatorId: partner.id,
            initiatorType: 'PARTNER',
            status: 'ACTIVE',
            endTime: { gt: now },
          },
          select: {
            id: true,
            title: true,
            description: true,
            maxParticipants: true,
            pricePerPerson: true,
            startTime: true,
            endTime: true,
            status: true,
            _count: {
              select: {
                GroupBookingParticipant: true,
              },
            },
          },
          orderBy: { startTime: 'asc' },
        })
      }

      const groups = groupBookings.map((group: any) => ({
        id: group.id,
        title: group.title,
        description: group.description,
        maxParticipants: group.maxParticipants,
        currentParticipants: group._count.GroupBookingParticipant,
        pricePerPerson: group.pricePerPerson,
        games: group.games || [],
        startTime: group.startTime instanceof Date ? group.startTime.toISOString() : group.startTime,
        endTime: group.endTime instanceof Date ? group.endTime.toISOString() : group.endTime,
        status: group.status,
      }))

      return {
        type: 'SUCCESS',
        partner: {
          id: partner.id,
          isAvailableNow: !!partner.isAvailableNow,
          isRankBooster: !!partner.isRankBooster,
          allowGroupBooking: !!partner.allowGroupBooking,
          availableNowSince: partner.availableNowSince instanceof Date ? partner.availableNowSince.toISOString() : partner.availableNowSince,
          rankBoosterImages: partner.rankBoosterImages || [],
          games: partner.games || [],
        },
        schedules,
        groups,
      } as const
    }, 'partner:dashboard:get')

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 })
    }

    return NextResponse.json({ partner: result.partner, schedules: result.schedules, groups: result.groups })
  } catch (error) {
    return createErrorResponse(error, 'partner:dashboard:get')
  }
}
