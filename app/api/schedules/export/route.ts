export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const fileFormat = searchParams.get('format') || 'csv'

    // 獲取當前用戶的 partner 信息
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    })

    if (!partner) {
      return NextResponse.json(
        { error: '找不到夥伴信息' },
        { status: 404 }
      )
    }

    const where = {
      partnerId: partner.id,
      ...(startDate && endDate
        ? {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }
        : {}),
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        bookings: {
          select: {
            id: true,
            status: true,
            customer: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    })

    if (fileFormat === 'csv') {
      const headers = [
        '日期',
        '開始時間',
        '結束時間',
        '狀態',
        '預約客戶',
        '客戶電話',
        '預約狀態',
      ]

      const rows = schedules.map((schedule) => {
        const booking = schedule.bookings[0]
        return [
          format(new Date(schedule.date), 'yyyy年MM月dd日', { locale: zhTW }),
          new Date(schedule.startTime).toISOString(),
          new Date(schedule.endTime).toISOString(),
          schedule.isAvailable ? '可預約' : '已預約',
          booking?.customer?.name || '',
          booking?.customer?.phone || '',
          booking?.status || '',
        ]
      })

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv;charset=utf-8',
          'Content-Disposition': `attachment; filename="schedules-${format(
            new Date(),
            'yyyyMMdd'
          )}.csv"`,
        },
      })
    }

    return NextResponse.json({ error: '不支持的格式' }, { status: 400 })
  } catch (error) {
    console.error('Error exporting schedules:', error)
    return NextResponse.json(
      { error: '匯出時段失敗' },
      { status: 500 }
    )
  }
} 