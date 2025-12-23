import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { withRateLimit } from '@/lib/middleware-rate-limit'
import { parseTaipeiDateTime, taipeiToUTC, addTaipeiTime } from '@/lib/time-utils'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export const dynamic = 'force-dynamic'

function parseDateRange(start?: string | null, end?: string | null) {
  if (!start || !end) return undefined

  // 使用台灣時區解析日期
  const startDate = parseTaipeiDateTime(start)
  const endDate = parseTaipeiDateTime(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return undefined
  }

  return {
    gte: startDate,
    lte: endDate,
  } as const
}

export async function GET(request: NextRequest) {
  try {
    // 【架構修復】添加 rate limiting，防止 availability API 爆炸
    const rateLimitResult = await withRateLimit(request, { 
      preset: 'GENERAL', // 60 次/分鐘
      endpoint: 'schedules:get'
    });
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const dateRange = parseDateRange(
      searchParams.get('startDate'),
      searchParams.get('endDate')
    )
    const partnerId = searchParams.get('partnerId') || undefined
    
    // 【架構修復】強制加上 limit 和 pagination，避免全表查詢
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // 預設 50，最大 100
    const offset = parseInt(searchParams.get('offset') || '0')
    const cursor = searchParams.get('cursor') // 支援 cursor-based pagination

    // 【架構修復】添加錯誤保護和 fallback
    let schedules: any[] = []
    try {
      schedules = await db.query(
        async (client) => {
          // 【架構修復】使用 limit 和 pagination，禁止全表查詢
          if (cursor) {
            // Cursor-based pagination（更高效）
            try {
              const cursorData = JSON.parse(cursor)
              return client.schedule.findMany({
                where: {
                  ...(dateRange ? { date: dateRange } : {}),
                  ...(partnerId ? { partnerId } : {}),
                  OR: [
                    { date: { gt: parseTaipeiDateTime(cursorData.date) } },
                    {
                      date: parseTaipeiDateTime(cursorData.date),
                      startTime: { gt: parseTaipeiDateTime(cursorData.startTime) },
                    },
                  ],
                },
                select: {
                  id: true,
                  partnerId: true,
                  date: true,
                  startTime: true,
                  endTime: true,
                  isAvailable: true,
                  partner: {
                    select: {
                      name: true,
                      games: true,
                      halfHourlyRate: true,
                    },
                  },
                  bookings: {
                    select: {
                      id: true,
                      status: true,
                    },
                  },
                },
                orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
                take: limit,
              })
            } catch (e) {
              // Invalid cursor, fallback to offset
              console.warn('Invalid cursor format, falling back to offset pagination')
            }
          }
          
          // Offset-based pagination（fallback）
          return client.schedule.findMany({
            where: {
              ...(dateRange ? { date: dateRange } : {}),
              ...(partnerId ? { partnerId } : {}),
            },
            select: {
              id: true,
              partnerId: true,
              date: true,
              startTime: true,
              endTime: true,
              isAvailable: true,
              partner: {
                select: {
                  name: true,
                  games: true,
                  halfHourlyRate: true,
                },
              },
              bookings: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            skip: offset,
            take: limit, // 【架構修復】強制 limit
          })
        },
        'schedules:list'
      )
    } catch (error: any) {
      // 【架構修復】DB timeout 時回傳 fallback（空陣列），避免 API 直接 throw
      console.error('❌ DB query error in schedules:list:', error?.message)
      if (error?.message?.includes('timeout') || error?.code?.includes('P1008') || error?.code?.includes('P1017')) {
        console.warn('⚠️ DB timeout, returning empty array as fallback')
        schedules = [] // Fallback to empty array
      } else {
        throw error // 非 timeout 錯誤繼續拋出
      }
    }

    // 【架構修復】生成 next cursor 用於 pagination
    const nextCursor = schedules.length === limit && schedules.length > 0
      ? JSON.stringify({
          date: schedules[schedules.length - 1].date,
          startTime: schedules[schedules.length - 1].startTime,
        })
      : null

    // 時段資料變動頻繁，使用較短的 private cache
    return NextResponse.json(
      { 
        schedules,
        pagination: {
          limit,
          offset,
          hasMore: schedules.length === limit,
          nextCursor,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        },
      }
    )
  } catch (error) {
    return createErrorResponse(error, 'schedules:list')
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const payload = await request.json()
    const { date, startTime, endTime, isRecurring, recurringWeeks } = payload

    const result = await db.query(
      async (client) => {
        const partner = await client.partner.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })

        if (!partner) {
          return { type: 'NO_PARTNER' } as const
        }

        const scheduleDate = new Date(date)
        if (Number.isNaN(scheduleDate.getTime())) {
          return { type: 'INVALID_DATE' } as const
        }

        const conflictCount = await client.schedule.count({
          where: {
            partnerId: partner.id,
            date: scheduleDate,
            OR: [
              {
                AND: [
                  { startTime: { lte: startTime } },
                  { endTime: { gt: startTime } },
                ],
              },
              {
                AND: [
                  { startTime: { lt: endTime } },
                  { endTime: { gte: endTime } },
                ],
              },
            ],
          },
        })

        if (conflictCount > 0) {
          return { type: 'CONFLICT' } as const
        }

        const created = await client.$transaction(async (tx) => {
          const baseSchedule = await tx.schedule.create({
            data: {
              partnerId: partner.id,
              date: scheduleDate,
              startTime,
              endTime,
              isAvailable: true,
            },
          })

          if (isRecurring && recurringWeeks > 1) {
            const entries = [] as {
              partnerId: string
              date: Date
              startTime: string
              endTime: string
              isAvailable: boolean
            }[]

            for (let i = 1; i < recurringWeeks; i++) {
              // 使用台灣時區計算下一個日期（加 7 天）
              const nextDate = addTaipeiTime(scheduleDate, i * 7, 'day')

              entries.push({
                partnerId: partner.id,
                date: nextDate,
                startTime,
                endTime,
                isAvailable: true,
              })
            }

            if (entries.length > 0) {
              await tx.schedule.createMany({ data: entries })
            }
          }

          return baseSchedule
        }, {
          maxWait: 10000, // 等待事務開始的最大時間（10秒）
          timeout: 20000, // 事務執行的最大時間（20秒）
        })

        return { type: 'SUCCESS', schedule: created } as const
      },
      'schedules:create'
    )

    if (result.type === 'NO_PARTNER') {
      return NextResponse.json({ error: '找不到夥伴信息' }, { status: 404 })
    }

    if (result.type === 'INVALID_DATE') {
      return NextResponse.json({ error: '日期格式錯誤' }, { status: 400 })
    }

    if (result.type === 'CONFLICT') {
      return NextResponse.json({ error: '時段與現有時段衝突' }, { status: 400 })
    }

    return NextResponse.json(result.schedule)
  } catch (error) {
    return createErrorResponse(error, 'schedules:create')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const payload = await request.json()
    const { id, date, startTime, endTime } = payload

    const result = await db.query(
      async (client) => {
        const partner = await client.partner.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })

        if (!partner) {
          return { type: 'NO_PARTNER' } as const
        }

        const schedule = await client.schedule.findFirst({
          where: {
            id,
            partnerId: partner.id,
          },
        })

        if (!schedule) {
          return { type: 'NOT_FOUND' } as const
        }

        const scheduleDate = new Date(date)
        if (Number.isNaN(scheduleDate.getTime())) {
          return { type: 'INVALID_DATE' } as const
        }

        const conflictCount = await client.schedule.count({
          where: {
            partnerId: partner.id,
            date: scheduleDate,
            id: { not: id },
            OR: [
              {
                AND: [
                  { startTime: { lte: startTime } },
                  { endTime: { gt: startTime } },
                ],
              },
              {
                AND: [
                  { startTime: { lt: endTime } },
                  { endTime: { gte: endTime } },
                ],
              },
            ],
          },
        })

        if (conflictCount > 0) {
          return { type: 'CONFLICT' } as const
        }

        const updated = await client.schedule.update({
          where: { id },
          data: {
            date: scheduleDate,
            startTime,
            endTime,
          },
        })

        return { type: 'SUCCESS', schedule: updated } as const
      },
      'schedules:update'
    )

    if (result.type === 'NO_PARTNER') {
      return NextResponse.json({ error: '找不到夥伴信息' }, { status: 404 })
    }

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '找不到時段' }, { status: 404 })
    }

    if (result.type === 'INVALID_DATE') {
      return NextResponse.json({ error: '日期格式錯誤' }, { status: 400 })
    }

    if (result.type === 'CONFLICT') {
      return NextResponse.json({ error: '時段與現有時段衝突' }, { status: 400 })
    }

    return NextResponse.json(result.schedule)
  } catch (error) {
    return createErrorResponse(error, 'schedules:update')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少時段ID' }, { status: 400 })
    }

    const result = await db.query(
      async (client) => {
        const partner = await client.partner.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })

        if (!partner) {
          return { type: 'NO_PARTNER' } as const
        }

        const schedule = await client.schedule.findFirst({
          where: {
            id,
            partnerId: partner.id,
          },
          select: { id: true },
        })

        if (!schedule) {
          return { type: 'NOT_FOUND' } as const
        }

        await client.schedule.delete({
          where: { id },
        })

        return { type: 'SUCCESS' } as const
      },
      'schedules:delete'
    )

    if (result.type === 'NO_PARTNER') {
      return NextResponse.json({ error: '找不到夥伴信息' }, { status: 404 })
    }

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '找不到時段' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return createErrorResponse(error, 'schedules:delete')
  }
} 