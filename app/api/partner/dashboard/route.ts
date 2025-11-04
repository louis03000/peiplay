import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 設定快取，避免每個請求都重新查詢
export const revalidate = 0

export async function GET() {
  try {
    console.log('✅ dashboard api triggered');

    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 不要手動 connect，使用 Prisma 的連接池管理
    // await prisma.$connect(); // 移除這行，讓 Prisma 自動管理連接

    // 使用 select 優化查詢，只獲取需要的欄位
    const partner = await prisma.partner.findUnique({
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
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            isAvailable: true,
            bookings: {
              select: {
                id: true,
                status: true
              }
            }
          },
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!partner) {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
    }

    // 處理時段數據 - 簡化 booked 邏輯
    const schedules = partner.schedules.map(schedule => {
      // bookings 可能是 null 或單一物件
      const booking = schedule.bookings;
      let isBooked = false;
      
      if (booking && booking.status) {
        const status = String(booking.status);
        isBooked = !['CANCELLED', 'REJECTED'].includes(status);
      }
      
      return {
        id: schedule.id,
        date: schedule.date instanceof Date ? schedule.date.toISOString() : schedule.date,
        startTime: schedule.startTime instanceof Date ? schedule.startTime.toISOString() : schedule.startTime,
        endTime: schedule.endTime instanceof Date ? schedule.endTime.toISOString() : schedule.endTime,
        isAvailable: schedule.isAvailable,
        booked: isBooked
      };
    });

    // 先將已過期的群組預約標記為 COMPLETED
    const now = new Date();
    await prisma.groupBooking.updateMany({
      where: {
        initiatorId: partner.id,
        initiatorType: 'PARTNER',
        status: 'ACTIVE',
        endTime: { lt: now } // 結束時間已過
      },
      data: {
        status: 'COMPLETED'
      }
    }).catch(err => console.warn('更新已過期群組預約狀態失敗:', err));

    // 使用 select 優化群組查詢
    // 注意：如果資料庫中沒有 games 欄位，會先不查詢它
    // 只查詢未來的群組預約（endTime > now）
    let groupBookings;
    try {
      groupBookings = await prisma.groupBooking.findMany({
        where: {
          initiatorId: partner.id,
          initiatorType: 'PARTNER',
          status: 'ACTIVE',
          endTime: { gt: now } // 只顯示未來的群組預約
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
          games: true,
          _count: {
            select: {
              GroupBookingParticipant: true
            }
          }
        },
        orderBy: { startTime: 'asc' }
      });
    } catch (error: any) {
      // 如果查詢 games 欄位失敗，可能是資料庫結構不同步，改用不包含 games 的查詢
      console.warn('⚠️ 查詢 games 欄位失敗，改用不包含 games 的查詢:', error?.message);
      groupBookings = await prisma.groupBooking.findMany({
        where: {
          initiatorId: partner.id,
          initiatorType: 'PARTNER',
          status: 'ACTIVE',
          endTime: { gt: now } // 只顯示未來的群組預約
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
          _count: {
            select: {
              GroupBookingParticipant: true
            }
          }
        },
        orderBy: { startTime: 'asc' }
      });
    }

    const groups = groupBookings.map((group: any) => ({
      id: group.id,
      title: group.title,
      description: group.description,
      maxParticipants: group.maxParticipants,
      currentParticipants: group._count.GroupBookingParticipant,
      pricePerPerson: group.pricePerPerson,
      games: group.games || [], // 如果沒有 games 欄位，使用空陣列
      startTime: group.startTime instanceof Date ? group.startTime.toISOString() : group.startTime,
      endTime: group.endTime instanceof Date ? group.endTime.toISOString() : group.endTime,
      status: group.status
    }));

    console.log("📊 找到夥伴資料:", {
      partnerId: partner.id,
      schedulesCount: schedules.length,
      groupsCount: groups.length
    });

    // 確保返回正確的狀態值（可能是 boolean 或 null）
    const result = {
      partner: {
        id: partner.id,
        isAvailableNow: !!partner.isAvailableNow, // 確保是 boolean
        isRankBooster: !!partner.isRankBooster, // 確保是 boolean
        allowGroupBooking: !!partner.allowGroupBooking, // 確保是 boolean
        availableNowSince: partner.availableNowSince instanceof Date ? partner.availableNowSince.toISOString() : partner.availableNowSince,
        rankBoosterImages: partner.rankBoosterImages || [],
        games: partner.games || []
      },
      schedules,
      groups
    };
    
    console.log('📊 返回夥伴狀態:', {
      isAvailableNow: result.partner.isAvailableNow,
      isRankBooster: result.partner.isRankBooster,
      allowGroupBooking: result.partner.allowGroupBooking
    });
    
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ 獲取夥伴儀表板失敗:', error);
    console.error('❌ 錯誤詳情:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      name: error?.name
    });
    
    // 返回錯誤，讓前端處理（不要返回 false 狀態，避免誤導）
    return NextResponse.json({
      error: '獲取夥伴儀表板失敗',
      details: error instanceof Error ? error.message : 'Unknown error',
      errorCode: error?.code || 'UNKNOWN',
      partner: null, // 明確標記為 null，讓前端知道這是錯誤情況
      schedules: [],
      groups: []
    }, { status: 500 });
  }
}
