import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";
import { BookingStatus } from "@prisma/client";
import { Cache, CacheKeys, CacheTTL, CacheInvalidation } from "@/lib/redis-cache";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ScheduleOutput = {
  id: string
  date: Date
  startTime: Date
  endTime: Date
  isAvailable: boolean
  bookings: { status: BookingStatus } | null
}

type PartnerRecord = {
  id: string
  name: string
  games: string[]
  halfHourlyRate: number
  coverImage: string | null
  images: string[]
  rankBoosterImages: string[] | null
  isAvailableNow: boolean
  isRankBooster: boolean
  allowGroupBooking: boolean
  rankBoosterNote: string | null
  rankBoosterRank: string | null
  customerMessage: string | null
  user: {
    isSuspended: boolean
    suspensionEndsAt: Date | null
  } | null
  schedules: ScheduleOutput[]
}

function parseDateRange(start?: string | null, end?: string | null) {
  if (!start || !end) return undefined
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return undefined
  }
  return { gte: startDate, lt: endDate }
}

const ACTIVE_BOOKING_STATUSES: Set<BookingStatus> = new Set([
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
  BookingStatus.PARTNER_ACCEPTED,
])

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl
    const startDate = url.searchParams.get("startDate")
    const endDate = url.searchParams.get("endDate")
    const availableNow = url.searchParams.get("availableNow") === 'true'
    const rankBooster = url.searchParams.get("rankBooster") === 'true'
    const game = url.searchParams.get("game")?.trim() || ''

    const dateRange = parseDateRange(startDate, endDate)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const scheduleDateFilter = dateRange ?? { gte: todayStart }

    // 生成快取 key（基於查詢參數）
    const cacheParams = {
      startDate: startDate || '',
      endDate: endDate || '',
      availableNow: availableNow ? 'true' : 'false',
      rankBooster: rankBooster ? 'true' : 'false',
      game: game || '',
    };
    const cacheKey = CacheKeys.partners.list(cacheParams);

    // 使用 Redis 快取（TTL: 2 分鐘，因為夥伴狀態可能頻繁變動）
    const partners = (await Cache.getOrSet(
      cacheKey,
      async () => {
        return await db.query(
          async (client) => {
            // 優化：在資料庫層面過濾被停權的用戶
            
            // 如果篩選「現在有空」，需要排除有活躍預約的夥伴
            let partnerWhere: any = {
              status: 'APPROVED',
              ...(rankBooster ? { isRankBooster: true } : {}),
              ...(availableNow ? { isAvailableNow: true } : {}),
              // 過濾被停權的用戶
              user: {
                OR: [
                  { isSuspended: false },
                  {
                    isSuspended: true,
                    suspensionEndsAt: {
                      lte: now, // 停權已過期
                    },
                  },
                ],
              },
            }

            // 優化：如果篩選「現在有空」，排除有活躍預約的夥伴
            // 使用更高效的查詢方式 - 直接查詢有活躍預約的 partnerId
            if (availableNow) {
              // 使用更高效的查詢方式 - 直接查詢有活躍預約的 partnerId
              // 使用 Prisma 查詢而非 raw query，確保類型安全
              const busySchedules = await client.schedule.findMany({
                where: {
                  bookings: {
                    status: {
                      in: Array.from(ACTIVE_BOOKING_STATUSES),
                    },
                  },
                  endTime: { gte: now }, // 預約尚未結束
                },
                select: {
                  partnerId: true,
                },
                distinct: ['partnerId'],
                take: 200, // 限制查詢數量
              })

              const partnerIds = busySchedules.map((s) => s.partnerId)

              // 排除有活躍預約的夥伴
              if (partnerIds.length > 0) {
                partnerWhere.id = {
                  notIn: partnerIds,
                }
              }
            }
            
            return client.partner.findMany({
              where: partnerWhere,
              select: {
                id: true,
                name: true,
                games: true,
                halfHourlyRate: true,
                coverImage: true,
                images: true,
                rankBoosterImages: true,
                isAvailableNow: true,
                isRankBooster: true,
                allowGroupBooking: true,
                rankBoosterNote: true,
                rankBoosterRank: true,
                customerMessage: true,
                user: {
                  select: {
                    isSuspended: true,
                    suspensionEndsAt: true,
                  },
                },
                schedules: {
                  where: {
                    isAvailable: true,
                    date: scheduleDateFilter,
                    // 優化：先查詢所有可用時段，然後在應用層過濾有活躍預約的
                    // 這樣可以避免 OR 條件影響索引使用
                  },
                  select: {
                    id: true,
                    date: true,
                    startTime: true,
                    endTime: true,
                    isAvailable: true,
                    bookings: {
                      select: {
                        status: true,
                      },
                    },
                  },
                  orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
                  take: 50, // 限制每個 partner 最多載入 50 個時段
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 50, // 減少為 50 筆，提升速度
              // 使用索引優化的排序
            });
          },
          'partners:list'
        );
      },
      CacheTTL.SHORT // 2 分鐘快取
    )) as unknown as PartnerRecord[];

    const processed = partners
      .map((partner) => {
        // normalize images (cover + rank booster proofs)
        let images = partner.images ?? []
        if ((!images || images.length === 0) && partner.coverImage) {
          images = [partner.coverImage]
        }
        if (partner.isRankBooster && partner.rankBoosterImages?.length) {
          images = [...images, ...partner.rankBoosterImages]
        }
        images = images.slice(0, 8)

        // 時段過濾：排除有活躍預約的時段（在應用層過濾，避免 OR 條件影響索引）
        const availableSchedules = partner.schedules
          .filter((schedule) => {
            // 如果沒有預約，或預約狀態不是活躍狀態，則可用
            if (!schedule.bookings) return true
            const status = schedule.bookings.status
            return !ACTIVE_BOOKING_STATUSES.has(status)
          })
          .map((schedule) => ({
            id: schedule.id,
            date: schedule.date,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            isAvailable: schedule.isAvailable,
            bookings: schedule.bookings,
          }))

        // When no additional filters, hide partners without schedules unless marked availableNow
        if (!rankBooster && !availableNow) {
          const hasSchedule = availableSchedules.length > 0
          if (!hasSchedule && !partner.isAvailableNow) {
            return null
          }
        }

        if (game) {
          const lower = game.toLowerCase()
          const match = partner.games.some((g) => g.toLowerCase().includes(lower))
          if (!match) {
            return null
          }
        }

        return {
          id: partner.id,
          name: partner.name,
          games: partner.games,
          halfHourlyRate: partner.halfHourlyRate,
          isAvailableNow: partner.isAvailableNow,
          isRankBooster: partner.isRankBooster,
          allowGroupBooking: partner.allowGroupBooking,
          rankBoosterNote: partner.rankBoosterNote,
          rankBoosterRank: partner.rankBoosterRank,
          customerMessage: partner.customerMessage,
          user: partner.user,
          images,
          schedules: availableSchedules,
        }
      })
      .filter((partner): partner is NonNullable<typeof partner> => partner !== null)

    // 設定 HTTP Cache Headers（Stale-While-Revalidate 策略）
    return NextResponse.json(processed, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    return createErrorResponse(error, 'partners:list')
  }
}

export async function POST(request: Request) {
  let data: Record<string, any> | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    data = await request.json()
    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
    const body = data as Record<string, unknown>
    // 驗證必填欄位（移除 userId）
    const requiredFields = ['name', 'birthday', 'phone', 'halfHourlyRate', 'games', 'coverImage', 'bankCode', 'bankAccountNumber', 'contractFile']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }
    // 驗證生日不能是未來日期
    if (new Date(body.birthday as string) > new Date()) {
      return NextResponse.json(
        { error: '生日不能是未來日期' },
        { status: 400 }
      )
    }
    const payload = body as {
      name: string
      birthday: string
      phone: string
      halfHourlyRate: number
      games: string[]
      coverImage: string
      contractFile: string
      bankCode: string
      bankAccountNumber: string
      inviteCode?: string
    }
    const result = await db.query(async (client) => {
      const exist = await client.partner.findUnique({ where: { userId: session.user!.id } });
      if (exist) {
        return { type: 'ALREADY_EXISTS' } as const;
      }

      let inviterId: string | null = null;
      if (payload.inviteCode) {
        const inviter = await client.partner.findFirst({
          where: {
            inviteCode: payload.inviteCode,
            status: 'APPROVED',
          },
        })

        if (!inviter) {
          return { type: 'INVALID_INVITE' } as const
        }

        inviterId = inviter.id
      }

      const partner = await client.partner.create({
        data: {
          userId: session.user.id,
          name: payload.name,
          birthday: new Date(payload.birthday),
          phone: payload.phone,
          halfHourlyRate: payload.halfHourlyRate,
          games: payload.games,
          coverImage: payload.coverImage,
          contractFile: payload.contractFile,
          bankCode: payload.bankCode,
          bankAccountNumber: payload.bankAccountNumber,
          invitedBy: inviterId,
        },
      })

      if (inviterId) {
        await client.referralRecord.create({
          data: {
            inviterId,
            inviteeId: partner.id,
            inviteCode: payload.inviteCode!,
          },
        })

        await client.partner.update({
          where: { id: inviterId },
          data: {
            referralCount: {
              increment: 1,
            },
          },
        })
      }

      return { type: 'SUCCESS', partner } as const
    }, 'partners:create')

    // 清除夥伴列表快取
    if (result.type === 'SUCCESS') {
      await CacheInvalidation.onPartnerUpdate(result.partner.id);
    }

    switch (result.type) {
      case 'ALREADY_EXISTS':
        return NextResponse.json({ error: '你已經申請過，不可重複申請' }, { status: 400 })
      case 'INVALID_INVITE':
        return NextResponse.json({ error: '無效的邀請碼' }, { status: 400 })
      case 'SUCCESS':
        return NextResponse.json(result.partner)
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error creating partner:', error, error instanceof Error ? error.stack : '', data ? JSON.stringify(data) : '')
    return createErrorResponse(error, 'partners:create')
  }
}