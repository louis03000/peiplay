import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const scheduleDateFilter = startDate && endDate
      ? {
          gte: new Date(startDate),
          lte: new Date(endDate),
        }
      : {
          gte: new Date(),
        }

    const partners = await prisma.partner.findMany({
      where: {
        isAvailableNow: true,
      },
      select: {
        id: true,
        name: true,
        games: true,
        hourlyRate: true,
        schedules: {
          where: {
            date: scheduleDateFilter,
            isAvailable: true,
          },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    })

    return NextResponse.json(partners)
  } catch (error) {
    console.error('Error fetching partners:', error)
    return NextResponse.json(
      { error: '獲取夥伴列表失敗' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  let data = null;
  try {
    data = await request.json()
    
    // 驗證必填欄位
    const requiredFields = ['userId', 'name', 'birthday', 'phone', 'hourlyRate', 'games', 'coverImage']
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

    // 建立新夥伴
    const partner = await prisma.partner.create({
      data: {
        user: { connect: { id: data.userId } },
        name: data.name,
        birthday: new Date(data.birthday),
        phone: data.phone,
        hourlyRate: data.hourlyRate,
        games: data.games,
        coverImage: data.coverImage,
      },
    })

    return NextResponse.json(partner)
  } catch (error) {
    console.error('Error creating partner:', error, error instanceof Error ? error.stack : '', JSON.stringify(data))
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create partner' },
      { status: 500 }
    )
  }
} 