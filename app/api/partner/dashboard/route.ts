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

    // 檢查用戶角色，只有 PARTNER 角色才能訪問
    if (session.user.role !== 'PARTNER') {
      return NextResponse.json({ error: '只有夥伴才能訪問此頁面' }, { status: 403 })
    }

    const result = await db.query(async (client) => {
      try {
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
                // bookings 是一對一關係（Booking?），直接選擇需要的字段
                select: {
                  id: true,
                  status: true,
                },
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
        // 如果 bookings 存在且狀態不是已取消或已拒絕，表示已被預約
        // bookings 是一對一關係（Booking?），是單個對象或 null
        const booking = schedule.bookings
        const isBooked = !!(booking && 
          booking.status && 
          booking.status !== 'CANCELLED' && 
          booking.status !== 'REJECTED')

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

      // 查詢群組預約
      // 注意：暫時不查詢 games 字段，因為數據庫中可能還沒有這個字段
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
          // games: true, // 暫時移除，因為數據庫中可能還沒有這個字段
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
      } catch (queryError: any) {
        console.error('❌ Dashboard 查詢時發生錯誤:', {
          message: queryError?.message,
          code: queryError?.code,
          meta: queryError?.meta,
          stack: queryError?.stack,
        });
        throw queryError;
      }
    }, 'partner:dashboard:get')

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 })
    }

    return NextResponse.json({ partner: result.partner, schedules: result.schedules, groups: result.groups })
  } catch (error) {
    console.error('❌ Dashboard API 外層錯誤:', error)
    console.error('錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      code: (error as any)?.code,
      meta: (error as any)?.meta,
    })
    return createErrorResponse(error, 'partner:dashboard:get')
  }
}
