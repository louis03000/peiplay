import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ScheduleOutput = {
  id: string
  date: Date
  startTime: Date
  endTime: Date
  isAvailable: boolean
  bookings: { status: string } | null
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

const ACTIVE_BOOKING_STATUSES = new Set([
  'PENDING',
  'CONFIRMED',
  'AWAITING_PAYMENT',
  'PROCESSING',
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

    const partners = await db.query<PartnerRecord[]>(
      async (client) => {
        return client.partner.findMany({
          where: {
            status: 'APPROVED',
            ...(rankBooster ? { isRankBooster: true } : {}),
            ...(availableNow ? { isAvailableNow: true } : {}),
          },
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
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      },
      'partners:list'
    )

    const processed = partners
      .map((partner) => {
        // filter out suspended partners
        if (partner.user?.isSuspended) {
          const endsAt = partner.user.suspensionEndsAt ? new Date(partner.user.suspensionEndsAt) : null
          if (endsAt && endsAt > now) {
            return null
          }
        }

        // normalize images (cover + rank booster proofs)
        let images = partner.images ?? []
        if ((!images || images.length === 0) && partner.coverImage) {
          images = [partner.coverImage]
        }
        if (partner.isRankBooster && partner.rankBoosterImages?.length) {
          images = [...images, ...partner.rankBoosterImages]
        }
        images = images.slice(0, 8)

        const availableSchedules = partner.schedules
          .filter((schedule) => {
            if (!schedule.bookings) return true
            return !ACTIVE_BOOKING_STATUSES.has(schedule.bookings.status)
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

    return NextResponse.json(processed)
  } catch (error) {
    return createErrorResponse(error, 'partners:list')
  }
}

export async function POST(request: Request) {
  let data = null;
  try {
    console.log('收到 POST /api/partners 請求');
    const session = await getServerSession(authOptions);
    console.log('session.user.id', session?.user?.id);
    const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
    console.log('user 查詢結果', user);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    data = await request.json()
    // 驗證必填欄位（移除 userId）
    const requiredFields = ['name', 'birthday', 'phone', 'halfHourlyRate', 'games', 'coverImage', 'bankCode', 'bankAccountNumber', 'contractFile']
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }
    // 驗證生日不能是未來日期
    if (new Date(data.birthday) > new Date()) {
      return NextResponse.json(
        { error: '生日不能是未來日期' },
        { status: 400 }
      )
    }
    // 檢查是否已經申請過
    const exist = await prisma.partner.findUnique({ where: { userId: session.user.id } });
    if (exist) {
      return NextResponse.json(
        { error: '你已經申請過，不可重複申請' },
        { status: 400 }
      );
    }

    // 處理邀請碼
    let inviterId = null;
    if (data.inviteCode) {
      const inviter = await prisma.partner.findFirst({
        where: { 
          inviteCode: data.inviteCode,
          status: 'APPROVED'
        }
      });
      
      if (inviter) {
        inviterId = inviter.id;
      } else {
        return NextResponse.json(
          { error: '無效的邀請碼' },
          { status: 400 }
        );
      }
    }

    // 建立新夥伴
    const partner = await prisma.partner.create({
      data: {
        userId: session.user.id,
        name: data.name,
        birthday: new Date(data.birthday),
        phone: data.phone,
        halfHourlyRate: data.halfHourlyRate,
        games: data.games,
        coverImage: data.coverImage,
        contractFile: data.contractFile,
        bankCode: data.bankCode,
        bankAccountNumber: data.bankAccountNumber,
        invitedBy: inviterId,
      },
    });

    // 如果有邀請人，建立推薦記錄
    if (inviterId) {
      await prisma.referralRecord.create({
        data: {
          inviterId,
          inviteeId: partner.id,
          inviteCode: data.inviteCode,
        }
      });

      // 更新邀請人的推薦數量
      await prisma.partner.update({
        where: { id: inviterId },
        data: {
          referralCount: {
            increment: 1
          }
        }
      });
    }
    return NextResponse.json(partner)
  } catch (error) {
    console.error('Error creating partner:', error, error instanceof Error ? error.stack : '', JSON.stringify(data))
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create partner' },
      { status: 500 }
    )
  }
}