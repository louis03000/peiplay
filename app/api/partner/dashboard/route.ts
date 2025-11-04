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
    const schedules = partner.schedules.map(schedule => ({
      id: schedule.id,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isAvailable: schedule.isAvailable,
      booked: schedule.bookings?.status && 
               !['CANCELLED', 'REJECTED'].includes(schedule.bookings.status)
    }));

    // 使用 select 優化群組查詢
    const groupBookings = await prisma.groupBooking.findMany({
      where: {
        initiatorId: partner.id,
        initiatorType: 'PARTNER',
        status: 'ACTIVE'
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

    const groups = groupBookings.map(group => ({
      id: group.id,
      title: group.title,
      description: group.description,
      maxParticipants: group.maxParticipants,
      currentParticipants: group._count.GroupBookingParticipant,
      pricePerPerson: group.pricePerPerson,
      games: group.games || [],
      startTime: group.startTime,
      endTime: group.endTime,
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
        availableNowSince: partner.availableNowSince,
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

  } catch (error) {
    console.error('❌ 獲取夥伴儀表板失敗:', error);
    
    // 返回錯誤，讓前端處理（不要返回 false 狀態，避免誤導）
    return NextResponse.json({
      error: '獲取夥伴儀表板失敗',
      details: error instanceof Error ? error.message : 'Unknown error',
      partner: null, // 明確標記為 null，讓前端知道這是錯誤情況
      schedules: [],
      groups: []
    }, { status: 500 });
  }
}
