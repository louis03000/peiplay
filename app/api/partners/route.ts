import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
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
            date: {
              gte: new Date(),
            },
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
  try {
    const data = await request.json()
    
    // 驗證必填欄位
    const requiredFields = ['name', 'birthday', 'phone', 'hourlyRate', 'games', 'coverImage']
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // 建立新夥伴
    const partner = await prisma.partner.create({
      data: {
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
    console.error('Error creating partner:', error)
    return NextResponse.json(
      { error: 'Failed to create partner' },
      { status: 500 }
    )
  }
} 