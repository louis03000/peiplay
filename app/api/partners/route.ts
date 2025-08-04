import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('session.user.id', session?.user?.id);
    const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
    console.log('user 查詢結果', user);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const availableNow = url.searchParams.get("availableNow");
    const rankBooster = url.searchParams.get("rankBooster");
    const game = url.searchParams.get("game");
    
    // 計算今天0點
    const now = new Date();
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
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
        rankBoosterNote: true,
        rankBoosterRank: true,
        customerMessage: true,
        user: {
          select: {
            isSuspended: true,
            suspensionEndsAt: true
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
          },
        },
      } as any,
      orderBy: { createdAt: 'desc' },
    });

    // 過濾掉沒有時段的夥伴，但如果有篩選條件則保留所有符合條件的夥伴
    let partnersWithSchedules = partners;
    if (!rankBooster && !availableNow) {
      // 只有在沒有篩選條件時才過濾掉沒有時段的夥伴
      partnersWithSchedules = partners.filter(partner => partner.schedules.length > 0);
    }

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
    return NextResponse.json({ error: "Error fetching partners" }, { status: 500 });
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
    const requiredFields = ['name', 'birthday', 'phone', 'halfHourlyRate', 'games', 'coverImage', 'bankCode', 'bankAccountNumber']
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
        bankCode: data.bankCode,
        bankAccountNumber: data.bankAccountNumber,
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