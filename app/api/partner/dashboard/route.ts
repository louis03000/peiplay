import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`✅ dashboard api triggered (attempt ${retryCount + 1})`);

      // 檢查認證
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: '請先登入' }, { status: 401 });
      }

      // 確保資料庫連線
      await prisma.$connect();

      // 查找夥伴資料
      const partner = await prisma.partner.findUnique({
        where: { userId: session.user.id },
        include: {
          schedules: {
            include: {
              bookings: {
                select: {
                  id: true,
                  status: true,
                  customer: {
                    select: { name: true }
                  }
                }
              }
            },
            orderBy: { startTime: 'asc' }
          },
        }
      });

      if (!partner) {
        return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
      }

      // 處理時段數據
      const schedules = partner.schedules.map(schedule => ({
        id: schedule.id,
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        isAvailable: schedule.isAvailable,
        booked: schedule.bookings && schedule.bookings.status && 
                 !['CANCELLED', 'REJECTED'].includes(schedule.bookings.status)
      }));

      // 處理群組數據 - 查詢該夥伴發起的群組預約
      const groupBookings = await prisma.groupBooking.findMany({
        where: {
          initiatorId: partner.id,
          initiatorType: 'PARTNER',
          status: 'ACTIVE'
        },
        include: {
          GroupBookingParticipant: {
            include: {
              Customer: true
            }
          }
        },
        orderBy: { startTime: 'asc' }
      });

      const groups = groupBookings.map(group => ({
        id: group.id,
        title: group.title,
        description: group.description,
        maxParticipants: group.maxParticipants,
        currentParticipants: group.GroupBookingParticipant.length,
        pricePerPerson: group.pricePerPerson,
        startTime: group.startTime,
        endTime: group.endTime,
        status: group.status
      }));

      console.log("📊 找到夥伴資料:", {
        partnerId: partner.id,
        schedulesCount: schedules.length,
        groupsCount: groups.length
      });

      return NextResponse.json({
        partner: {
          id: partner.id,
          isAvailableNow: partner.isAvailableNow,
          isRankBooster: partner.isRankBooster,
          allowGroupBooking: partner.allowGroupBooking,
          availableNowSince: partner.availableNowSince,
          rankBoosterImages: partner.rankBoosterImages,
          games: partner.games || []
        },
        schedules,
        groups
      });

    } catch (error) {
      retryCount++;
      console.error(`❌ 獲取夥伴儀表板失敗 (attempt ${retryCount}):`, error);
      
      // 如果是最後一次重試，返回空數據而不是錯誤
      if (retryCount >= maxRetries) {
        console.error("❌ 所有重試都失敗了，返回空數據");
        return NextResponse.json({
          partner: {
            id: '',
            isAvailableNow: false,
            isRankBooster: false,
            allowGroupBooking: false,
            availableNowSince: null,
            rankBoosterImages: [],
            games: []
          },
          schedules: [],
          groups: [],
          error: '獲取夥伴儀表板失敗，返回空數據',
          details: error instanceof Error ? error.message : 'Unknown error',
          retryAttempts: retryCount
        });
      }
      
      // 等待一段時間後重試
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    } finally {
      // 確保斷開連線
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        console.error("❌ 斷開連線失敗:", disconnectError);
      }
    }
  }
}
