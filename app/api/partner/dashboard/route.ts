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
      
      // 優化：移除每次請求時的 updateMany 操作（這個操作很慢）
      // 應該移到後台任務（cron job）或只在用戶主動操作時執行
      // 如果需要在這裡執行，可以改為異步執行，不阻塞主查詢
      
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
              // 優化：移除 OR 條件，直接使用 gte（更高效）
              date: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
            },
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              isAvailable: true,
              bookings: {
                where: {
                  // 優化：只查詢有效的預約（排除已取消和已拒絕的）
                  status: {
                    notIn: ['CANCELLED', 'REJECTED'],
                  },
                },
                select: {
                  id: true,
                  status: true,
                },
                // 注意：Prisma 的嵌套 select 不支持 take，但由於我們已經過濾了狀態，
                // 每個時段通常只有0或1個有效預約，所以不需要限制數量
              },
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            take: 100, // 優化：減少載入的時段數量（從 200 降到 100）
          },
        },
      })

      if (!partner) {
        return { type: 'NOT_FOUND' } as const
      }

      // 優化：簡化 schedules 處理邏輯
      const schedules = partner.schedules.map((schedule) => {
        // 如果 bookings 陣列有元素，表示已被預約
        const isBooked = schedule.bookings && schedule.bookings.length > 0

        return {
          id: schedule.id,
          date: schedule.date instanceof Date ? schedule.date.toISOString() : schedule.date,
          startTime: schedule.startTime instanceof Date ? schedule.startTime.toISOString() : schedule.startTime,
          endTime: schedule.endTime instanceof Date ? schedule.endTime.toISOString() : schedule.endTime,
          isAvailable: schedule.isAvailable,
          booked: isBooked,
        }
      })

      // 優化：移除阻塞性的 updateMany 操作（應該移到後台任務）
      // 如果需要在這裡執行，可以改為異步執行，不阻塞主查詢
      // await client.groupBooking.updateMany({...}).catch(...)

      // 優化：簡化 groupBookings 查詢，移除 try-catch（如果 games 欄位不存在，直接不查詢）
      const groupBookings = await client.groupBooking.findMany({
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
          // 優化：如果 games 欄位可能不存在，可以移除或使用可選欄位
          _count: {
            select: {
              GroupBookingParticipant: true,
            },
          },
        },
        orderBy: { startTime: 'asc' },
        take: 50, // 優化：限制群組預約數量
      })

      const groups = groupBookings.map((group: any) => ({
        id: group.id,
        title: group.title,
        description: group.description,
        maxParticipants: group.maxParticipants,
        currentParticipants: group._count?.GroupBookingParticipant || 0,
        pricePerPerson: group.pricePerPerson,
        games: (group as any).games || [], // 使用類型斷言，如果欄位不存在則返回空陣列
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
