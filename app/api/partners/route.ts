import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 測試資料庫連接
    await prisma.$connect()
    
    const session = await getServerSession(authOptions);
    console.log('session.user.id', session?.user?.id);
    const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
    console.log('user 查詢結果', user);
    // 允許未登入用戶查看夥伴列表（用於預約頁面）
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: '請先登入' }, { status: 401 });
    // }
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const availableNow = url.searchParams.get("availableNow");
    const rankBooster = url.searchParams.get("rankBooster");
    const game = url.searchParams.get("game");
    
    // 計算今天0點
    const now = new Date();
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    // 時段查詢條件：如果有指定日期範圍就用指定的，否則查詢從今天開始的所有時段
    const scheduleDateFilter = startDate && endDate ? {
      gte: new Date(startDate),
      lt: new Date(endDate),
    } : {
      gte: todayZero,
    };

    // 修改查詢邏輯：顯示所有有時段的夥伴，開關只是額外篩選
    let where: any = { status: 'APPROVED' };
    
    // 如果有特定篩選條件，則套用篩選
    if (rankBooster === 'true') {
      where.isRankBooster = true;
    }
    
    if (availableNow === 'true') {
      where.isAvailableNow = true;
    }

    console.log('🔍 API 查詢條件:', where);
    
    const partners = await prisma.partner.findMany({
      where,
      select: {
        id: true,
        name: true,
        games: true,
        halfHourlyRate: true,
        coverImage: true,
        images: true, // 新增多張圖片
        isAvailableNow: true,
        isRankBooster: true,
        allowGroupBooking: true,
        rankBoosterNote: true,
        rankBoosterRank: true,
        rankBoosterImages: true,
        customerMessage: true,
        user: {
          select: {
            isSuspended: true,
            suspensionEndsAt: true,
            reviewsReceived: {
              where: {
                isApproved: true
              },
              select: {
                rating: true
              }
            }
          }
        },
        schedules: {
          where: {
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
                id: true
              }
            }
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('📊 原始查詢結果:', partners.map(p => ({ name: p.name, isAvailableNow: p.isAvailableNow, schedulesCount: p.schedules.length })));

    // 過濾掉沒有時段的夥伴，但「現在有空」的夥伴除外
    let partnersWithSchedules = partners;
    if (!rankBooster && !availableNow) {
      // 只有在沒有篩選條件時才過濾掉沒有時段的夥伴，但「現在有空」的夥伴例外
      partnersWithSchedules = partners.filter(partner => 
        partner.schedules.length > 0 || partner.isAvailableNow
      );
    }

    console.log('📊 篩選後結果:', partnersWithSchedules.map(p => ({ name: p.name, isAvailableNow: p.isAvailableNow, schedulesCount: p.schedules.length })));

    // 過濾掉已預約的時段，只保留可用的時段，並計算平均星等
    partnersWithSchedules = partnersWithSchedules.map(partner => {
      // 計算平均星等
      const reviews = partner.user?.reviewsReceived || [];
      const averageRating = reviews.length > 0 
        ? reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / reviews.length
        : 0;
      
      return {
        ...partner,
        averageRating: Math.round(averageRating * 10) / 10, // 保留一位小數
        totalReviews: reviews.length,
        schedules: partner.schedules.filter(schedule => {
          // 如果時段本身不可用，則過濾掉
          if (!schedule.isAvailable) return false;
          
          // 如果有預約記錄且狀態不是 CANCELLED 或 REJECTED，則時段不可用
          if (schedule.bookings && schedule.bookings.status && !['CANCELLED', 'REJECTED'].includes(schedule.bookings.status)) {
            return false;
          }
          
          return true;
        })
      };
    }).filter(partner => partner.schedules.length > 0 || partner.isAvailableNow); // 過濾掉沒有可用時段的夥伴，但「現在有空」的夥伴例外

    // 過濾掉被停權的夥伴
    partnersWithSchedules = partnersWithSchedules.filter(partner => {
      if (!partner.user) return true;
      
      // 檢查是否被停權
      const user = partner.user as any;
      if (user.isSuspended) {
        const now = new Date();
        const endsAt = user.suspensionEndsAt ? new Date(user.suspensionEndsAt) : null;
        
        // 如果停權時間還沒到，則過濾掉
        if (endsAt && endsAt > now) {
          return false;
        }
      }
      
      return true;
    });
    
    // 遊戲搜尋篩選（不區分大小寫）
    if (game && game.trim()) {
      const searchTerm = game.trim().toLowerCase();
      partnersWithSchedules = partnersWithSchedules.filter(partner => {
        const games = (partner as any).games as string[];
        return games.some(gameName => 
          gameName.toLowerCase().includes(searchTerm)
        );
      });
    }
    
    return NextResponse.json(partnersWithSchedules);
  } catch (error) {
    console.error("Error fetching partners:", error);
    
    // 如果是資料庫連接錯誤，返回更友好的錯誤信息
    if (error instanceof Error && error.message.includes('connect')) {
      return NextResponse.json({ 
        error: '資料庫連接失敗，請稍後再試',
        partners: []
      }, { status: 503 })
    }
    
    return NextResponse.json({ 
      error: "Error fetching partners",
      partners: []
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('Database disconnect error:', disconnectError)
    }
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