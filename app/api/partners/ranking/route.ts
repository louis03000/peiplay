import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    // 計算所有夥伴的預約總時長
    const partnersWithTotalHours = await prisma.partner.findMany({
      where: {
        status: 'APPROVED'
      },
      select: {
        id: true,
        name: true,
        coverImage: true,
        games: true,
        halfHourlyRate: true,
        isAvailableNow: true,
        isRankBooster: true,
        schedules: {
          where: {
            bookings: {
              some: {
                status: 'COMPLETED' // 只計算已完成的預約
              }
            }
          },
          select: {
            startTime: true,
            endTime: true,
            bookings: {
              where: {
                status: 'COMPLETED'
              },
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    // 計算每個夥伴的總時長（分鐘）
    const rankingData = partnersWithTotalHours.map(partner => {
      let totalMinutes = 0;
      
      partner.schedules.forEach(schedule => {
        if (schedule.startTime && schedule.endTime) {
          const start = new Date(schedule.startTime);
          const end = new Date(schedule.endTime);
          const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
          totalMinutes += durationMinutes;
        }
      });

      return {
        id: partner.id,
        name: partner.name,
        coverImage: partner.coverImage,
        games: partner.games,
        halfHourlyRate: partner.halfHourlyRate,
        isAvailableNow: partner.isAvailableNow,
        isRankBooster: partner.isRankBooster,
        totalMinutes: totalMinutes,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10 // 四捨五入到小數點後一位
      };
    });

    // 按總時長排序（降序）
    const sortedRanking = rankingData
      .filter(partner => partner.totalMinutes > 0) // 只顯示有預約記錄的夥伴
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .map((partner, index) => ({
        ...partner,
        rank: index + 1
      }));

    return NextResponse.json(sortedRanking);
  } catch (error) {
    console.error("Error fetching ranking:", error);
    return NextResponse.json({ error: "Error fetching ranking" }, { status: 500 });
  }
}