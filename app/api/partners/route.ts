import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { hasTimeOverlap } from "@/lib/time-conflict";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      const url = new URL(request.url);
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      const availableNow = url.searchParams.get("availableNow");
      const rankBooster = url.searchParams.get("rankBooster");
      const game = url.searchParams.get("game");
      
      // 不需要手動連接，Prisma 會自動管理連接
    
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

    // 添加查詢超時和性能優化
    const queryStartTime = Date.now();
    
    // 首先只獲取基本的夥伴資料，減少查詢複雜度
    const partners = await Promise.race([
      prisma.partner.findMany({
        where,
        select: {
          id: true,
          name: true,
          games: true,
          halfHourlyRate: true,
          coverImage: true,
          images: true,
          isAvailableNow: true,
          isRankBooster: true,
          allowGroupBooking: true,
          rankBoosterNote: true,
          rankBoosterRank: true,
          rankBoosterImages: true,
          customerMessage: true,
          userId: true, // 需要這個來查詢 user
          user: {
            select: {
              isSuspended: true,
              suspensionEndsAt: true
            }
          },
          _count: {
            select: {
              schedules: {
                where: {
                  date: scheduleDateFilter,
                  isAvailable: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // 限制返回數量，避免一次載入過多數據
      }),
      // 30秒超時
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000)
      ) as Promise<never>
    ]);

    const queryTime = Date.now() - queryStartTime;
    console.log(`📊 Partners query completed in ${queryTime}ms, found ${partners.length} partners`);

    // 對於有可用時段的夥伴，再單獨查詢時段詳細資料（分批處理，避免 N+1）
    const partnerIdsWithSchedules = partners
      .filter(p => p._count.schedules > 0 || p.isAvailableNow)
      .map(p => p.id);

    // 批量查詢時段資料（只查詢需要的）
    const schedulesMap = new Map<string, any[]>();
    // 按 partnerId 分組預約，用於快速查找衝突（移到外層作用域）
    const bookingsByPartner = new Map<string, Array<{ startTime: Date; endTime: Date }>>();
    
    if (partnerIdsWithSchedules.length > 0) {
      // 先查詢所有有效預約，用於衝突檢查
      const activeBookings = await prisma.booking.findMany({
        where: {
          schedule: {
            partnerId: { in: partnerIdsWithSchedules },
            date: scheduleDateFilter
          },
          status: {
            notIn: ['CANCELLED', 'REJECTED', 'COMPLETED']
          }
        },
        select: {
          id: true,
          status: true,
          schedule: {
            select: {
              partnerId: true,
              startTime: true,
              endTime: true
            }
          }
        }
      });
      for (const booking of activeBookings) {
        const partnerId = booking.schedule.partnerId;
        if (!bookingsByPartner.has(partnerId)) {
          bookingsByPartner.set(partnerId, []);
        }
        bookingsByPartner.get(partnerId)!.push({
          startTime: booking.schedule.startTime,
          endTime: booking.schedule.endTime
        });
      }

      const schedules = await Promise.race([
        prisma.schedule.findMany({
          where: {
            partnerId: { in: partnerIdsWithSchedules },
            date: scheduleDateFilter,
            isAvailable: true,
          },
          select: {
            id: true,
            partnerId: true,
            date: true,
            startTime: true,
            endTime: true,
            isAvailable: true,
          },
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Schedules query timeout')), 15000)
        ) as Promise<never>
      ]);

      // 過濾掉與已預約時段重疊的時段
      const validSchedules = schedules.filter(schedule => {
        const partnerBookings = bookingsByPartner.get(schedule.partnerId) || [];
        const scheduleStart = new Date(schedule.startTime);
        const scheduleEnd = new Date(schedule.endTime);
        
        // 檢查是否與任何已預約時段重疊
        for (const booking of partnerBookings) {
          if (hasTimeOverlap(
            scheduleStart,
            scheduleEnd,
            new Date(booking.startTime),
            new Date(booking.endTime)
          )) {
            return false; // 有重疊，排除這個時段
          }
        }
        
        return true; // 沒有重疊，保留這個時段
      });

      // 將過濾後的時段按 partnerId 分組
      for (const schedule of validSchedules) {
        if (!schedulesMap.has(schedule.partnerId)) {
          schedulesMap.set(schedule.partnerId, []);
        }
        schedulesMap.get(schedule.partnerId)!.push(schedule);
      }
    }

    // 處理和過濾夥伴資料
    let partnersWithSchedules = partners
      .filter(partner => {
        // 過濾掉沒有時段的夥伴，但「現在有空」的夥伴除外
        if (!rankBooster && !availableNow) {
          return partner._count.schedules > 0 || partner.isAvailableNow;
        }
        return true;
      })
      .map(partner => {
        // 處理圖片陣列：先添加封面照（images），然後添加段位證明圖片（rankBoosterImages）
        let images = partner.images || [];
        if (images.length === 0 && partner.coverImage) {
          images = [partner.coverImage];
        }
        
        // 如果是上分高手，將段位證明圖片添加到封面照後面
        if (partner.isRankBooster && partner.rankBoosterImages && partner.rankBoosterImages.length > 0) {
          images = [...images, ...partner.rankBoosterImages];
        }
        
        // 最多顯示8張（封面照優先，段位證明圖片在後面）
        images = images.slice(0, 8);
        
        // 獲取該夥伴的時段（如果有的話）
        const schedules = schedulesMap.get(partner.id) || [];
        // 獲取該夥伴的所有有效預約，用於檢查時間衝突
        const partnerBookings = bookingsByPartner.get(partner.id) || [];
        
        // 過濾掉與已預約時段重疊的時段
        const availableSchedules = schedules.filter(schedule => {
          const scheduleStart = new Date(schedule.startTime);
          const scheduleEnd = new Date(schedule.endTime);
          
          // 檢查是否與任何已預約時段重疊
          for (const booking of partnerBookings) {
            if (hasTimeOverlap(
              scheduleStart,
              scheduleEnd,
              new Date(booking.startTime),
              new Date(booking.endTime)
            )) {
              return false; // 有重疊，排除這個時段
            }
          }
          
          return true; // 沒有重疊，保留這個時段
        });
        
        // 移除 _count 和 userId，保留需要的字段
        const { _count, userId, ...partnerData } = partner;
        
        return {
          ...partnerData,
          images,
          averageRating: 0,
          totalReviews: 0,
          schedules: availableSchedules.map(s => ({
            id: s.id,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            isAvailable: s.isAvailable,
            bookings: s.bookings
          }))
        };
      })
      .filter(partner => partner.schedules.length > 0 || partner.isAvailableNow);

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
    } catch (error: any) {
      retryCount++;
      console.error(`Error fetching partners (attempt ${retryCount}/${maxRetries}):`, error);
      
      // 檢查是否為可重試的錯誤
      const isConnectionError = 
        error?.code === 'P1001' || // Can't reach database server
        error?.code === 'P1002' || // Connection timeout
        error?.code === 'P1003' || // Database does not exist
        error?.code === 'P1017' || // Server has closed the connection
        error?.code === 'P2002' || // Unique constraint failed (可能是連接問題導致的)
        error?.code === 'P2024' || // Timed out fetching a new connection from the connection pool
        error?.code === 'P2034' || // Transaction failed due to a write conflict or a deadlock
        (error?.message && (
          error.message.includes('connect') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('connection pool') ||
          error.message.includes('Connection closed')
        ));
      
      if (isConnectionError && retryCount < maxRetries) {
        const delay = Math.min(retryCount * 1000, 5000); // 最多等待5秒
        console.log(`⏳ 資料庫連接錯誤，等待 ${delay}ms 後重試... (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // 重試
      }
      
      // 如果是最後一次重試或非連接錯誤，返回錯誤
      if (isConnectionError) {
        console.error('❌ 資料庫連接失敗，所有重試已用盡');
        return NextResponse.json({ 
          error: '資料庫連接失敗，請稍後再試',
          partners: [],
          retryAttempts: retryCount
        }, { status: 503 });
      }
      
      // 其他錯誤
      console.error('❌ 獲取夥伴資料失敗:', error);
      return NextResponse.json({ 
        error: "獲取夥伴資料失敗",
        partners: [],
        details: error instanceof Error ? error.message : 'Unknown error',
        retryAttempts: retryCount
      }, { status: 500 });
    }
  }
  
  // 如果所有重試都失敗了（理論上不會到達這裡）
  return NextResponse.json({ 
    error: '獲取夥伴資料失敗，請稍後再試',
    partners: [],
    retryAttempts: maxRetries
  }, { status: 503 });
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