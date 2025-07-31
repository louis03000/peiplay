import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 獲取所有已批准的夥伴
    const partners = await prisma.partner.findMany({
      where: {
        status: 'APPROVED'
      },
      include: {
        schedules: {
          include: {
            bookings: {
              where: {
                status: {
                  in: ['CONFIRMED', 'COMPLETED'] // 包含已確認和已完成的預約
                }
              }
            }
          }
        }
      }
    })

    // 計算每個夥伴的總預約時長
    const rankingData = partners.map(partner => {
      let totalMinutes = 0

      partner.schedules.forEach(schedule => {
        schedule.bookings.forEach(booking => {
          // 只計算已確認和已完成的預約
          if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') {
            const startTime = new Date(schedule.startTime)
            const endTime = new Date(schedule.endTime)
            const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
            totalMinutes += durationMinutes
          }
        })
      })

      return {
        id: partner.id,
        name: partner.name,
        games: partner.games,
        totalMinutes: Math.round(totalMinutes),
        coverImage: partner.coverImage,
        isAvailableNow: partner.isAvailableNow,
        isRankBooster: partner.isRankBooster,
        rank: 0 // 稍後排序
      }
    })

    // 按總時長排序並分配排名
    const sortedData = rankingData
      .filter(partner => partner.totalMinutes > 0) // 只顯示有預約的夥伴
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .map((partner, index) => ({
        ...partner,
        rank: index + 1
      }))

    return NextResponse.json(sortedData)

  } catch (error) {
    console.error('Error fetching ranking data:', error)
    return NextResponse.json(
      { error: '獲取排行榜資料失敗' },
      { status: 500 }
    )
  }
}