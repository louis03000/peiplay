import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取夥伴的群組預約
export async function GET() {
  try {
    console.log('🔍 GET /api/partner/groups 開始處理...');
    
    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 確保資料庫連線
    await prisma.$connect();

    // 查找夥伴資料
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    });

    if (!partner) {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
    }

    // 查詢該夥伴發起的群組預約
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
      status: group.status,
      games: group.games || [],
      startTime: group.startTime.toISOString(),
      endTime: group.endTime.toISOString()
    }));

    console.log('📊 找到群組預約:', groups.length);
    return NextResponse.json(groups);

  } catch (error) {
    console.error('❌ 獲取群組預約失敗:', error);
    return NextResponse.json({ error: '獲取群組預約失敗' }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}

// 創建新的群組預約
export async function POST(request: Request) {
  try {
    console.log('🚀 開始處理群組預約創建請求...');
    
    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const data = await request.json();
    console.log('📊 請求數據:', data);
    
    // 驗證必要欄位
    if (!data.title || !data.date || !data.startTime || !data.endTime || !data.pricePerPerson) {
      console.error('❌ 缺少必要欄位:', { title: data.title, date: data.date, startTime: data.startTime, endTime: data.endTime, pricePerPerson: data.pricePerPerson });
      return NextResponse.json({ 
        error: '缺少必要欄位',
        details: '請填寫群組標題、日期、開始時間、結束時間和每人費用'
      }, { status: 400 });
    }

    // 確保資料庫連線
    await prisma.$connect();

    // 查找夥伴資料
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    });

    if (!partner) {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
    }

    // 查找用戶資料
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user) {
      return NextResponse.json({ error: '用戶資料不存在' }, { status: 404 });
    }

    // 查找或創建客戶記錄
    let customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      try {
        customer = await prisma.customer.create({
          data: {
            id: `customer-${session.user.id}`,
            userId: session.user.id,
            name: user.name || '未知客戶',
            birthday: new Date('1990-01-01'), // 默認生日
            phone: '0000000000' // 默認電話
          }
        });
      } catch (createError) {
        console.error('❌ 創建客戶記錄失敗:', createError);
        // 如果創建失敗，可能是並發問題，再試一次查找
        customer = await prisma.customer.findUnique({
          where: { userId: session.user.id }
        });
        if (!customer) {
          return NextResponse.json({ error: '無法創建客戶記錄' }, { status: 500 });
        }
      }
    }

    // 驗證和解析日期時間
    let startTime: Date;
    let endTime: Date;
    
    try {
      // 確保日期格式正確 (YYYY-MM-DD)
      let dateStr = data.date;
      if (dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0]; // 只取日期部分
      }
      
      // 處理時間格式 (可能是 HH:MM 或 HH:MM:SS 或完整的 ISO 字符串)
      let startTimeStr = data.startTime;
      if (startTimeStr.includes('T')) {
        // 如果是完整的 ISO 字符串，提取時間部分
        const timePart = startTimeStr.split('T')[1]?.split('Z')[0]?.split('+')[0];
        startTimeStr = timePart || startTimeStr;
      }
      // 確保時間格式是 HH:MM 或 HH:MM:SS
      const startTimeParts = startTimeStr.split(':');
      if (startTimeParts.length === 2) {
        startTimeStr = `${startTimeStr}:00`; // 如果沒有秒數，加上 :00
      }
      
      let endTimeStr = data.endTime;
      if (endTimeStr.includes('T')) {
        const timePart = endTimeStr.split('T')[1]?.split('Z')[0]?.split('+')[0];
        endTimeStr = timePart || endTimeStr;
      }
      const endTimeParts = endTimeStr.split(':');
      if (endTimeParts.length === 2) {
        endTimeStr = `${endTimeStr}:00`;
      }
      
      // 組合日期和時間字符串 (本地時區格式)
      const startDateTimeStr = `${dateStr}T${startTimeStr}`;
      const endDateTimeStr = `${dateStr}T${endTimeStr}`;
      
      console.log('🔍 解析時間字符串:', { dateStr, startTimeStr, endTimeStr, startDateTimeStr, endDateTimeStr });
      
      startTime = new Date(startDateTimeStr);
      endTime = new Date(endDateTimeStr);
      
      // 驗證日期是否有效
      if (isNaN(startTime.getTime())) {
        throw new Error(`無效的開始時間格式: ${startDateTimeStr}`);
      }
      if (isNaN(endTime.getTime())) {
        throw new Error(`無效的結束時間格式: ${endDateTimeStr}`);
      }
      
      // 驗證結束時間是否晚於開始時間
      if (endTime <= startTime) {
        return NextResponse.json({ 
          error: '結束時間必須晚於開始時間' 
        }, { status: 400 });
      }
      
      console.log('📅 解析後的時間:', { 
        startTime: startTime.toISOString(), 
        endTime: endTime.toISOString(),
        startTimeLocal: startTime.toLocaleString('zh-TW'),
        endTimeLocal: endTime.toLocaleString('zh-TW')
      });
    } catch (dateError) {
      console.error('❌ 日期時間解析失敗:', dateError);
      return NextResponse.json({ 
        error: '日期時間格式錯誤',
        details: dateError instanceof Error ? dateError.message : '請檢查日期和時間格式'
      }, { status: 400 });
    }

    // 驗證價格是否為正數
    if (data.pricePerPerson <= 0) {
      return NextResponse.json({ 
        error: '每人費用必須大於0' 
      }, { status: 400 });
    }

    // 驗證最大參與人數
    const maxParticipants = data.maxParticipants || 4;
    if (maxParticipants < 2 || maxParticipants > 9) {
      return NextResponse.json({ 
        error: '最大參與人數必須在2到9人之間' 
      }, { status: 400 });
    }

    let groupBooking;
    try {
      groupBooking = await prisma.groupBooking.create({
        data: {
          id: `gb-${Date.now()}`,
          type: 'PARTNER_INITIATED',
          title: data.title.trim(),
          description: data.description ? data.description.trim() : null,
          date: startTime,
          startTime: startTime,
          endTime: endTime,
          maxParticipants: maxParticipants,
          currentParticipants: 0,
          pricePerPerson: parseFloat(data.pricePerPerson),
          status: 'ACTIVE',
          initiatorId: partner.id,
          initiatorType: 'PARTNER',
          games: Array.isArray(data.games) ? data.games.filter((g: any) => g && typeof g === 'string') : []
        }
      });
      console.log('✅ 群組預約記錄創建成功:', groupBooking.id);
    } catch (createError: any) {
      console.error('❌ 創建群組預約記錄失敗:', createError);
      // 檢查是否是唯一性約束錯誤
      if (createError.code === 'P2002') {
        return NextResponse.json({ 
          error: '群組預約ID已存在，請稍後再試',
          details: '系統正在處理另一個請求'
        }, { status: 409 });
      }
      throw createError;
    }

    // 創建群組參與者記錄（發起者）
    try {
      await prisma.groupBookingParticipant.create({
        data: {
          id: `gbp-${groupBooking.id}-${partner.id}`,
          groupBookingId: groupBooking.id,
          customerId: customer.id,
          partnerId: partner.id,
          status: 'ACTIVE'
        }
      });
      console.log('✅ 群組參與者記錄創建成功');
    } catch (participantError: any) {
      console.error('❌ 創建群組參與者記錄失敗:', participantError);
      // 如果參與者創建失敗，刪除已創建的群組預約
      try {
        await prisma.groupBooking.delete({ where: { id: groupBooking.id } });
      } catch (deleteError) {
        console.error('❌ 清理失敗的群組預約記錄失敗:', deleteError);
      }
      
      if (participantError.code === 'P2002') {
        return NextResponse.json({ 
          error: '參與者記錄已存在',
          details: '您已經參與了這個群組'
        }, { status: 409 });
      }
      throw participantError;
    }

    // 更新群組預約的當前參與人數
    try {
      await prisma.groupBooking.update({
        where: { id: groupBooking.id },
        data: { currentParticipants: 1 }
      });
    } catch (updateError) {
      console.error('❌ 更新群組預約參與人數失敗:', updateError);
      // 這個錯誤不是致命的，繼續執行
    }

    // 確保夥伴的 allowGroupBooking 狀態為 true
    try {
      await prisma.partner.update({
        where: { id: partner.id },
        data: { allowGroupBooking: true }
      });
    } catch (updateError) {
      console.error('❌ 更新夥伴群組預約設置失敗:', updateError);
      // 這個錯誤不是致命的，繼續執行
    }

    console.log("✅ 群組預約創建成功:", groupBooking.id);

    return NextResponse.json({
      success: true,
      groupBooking: {
        id: groupBooking.id,
        title: groupBooking.title,
        description: groupBooking.description,
        maxParticipants: groupBooking.maxParticipants,
        currentParticipants: 1,
        pricePerPerson: groupBooking.pricePerPerson,
        status: groupBooking.status,
        games: groupBooking.games || [],
        startTime: groupBooking.startTime.toISOString(),
        endTime: groupBooking.endTime.toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('❌ 創建群組預約失敗:', error);
    console.error('❌ 錯誤詳情:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    });
    
    // 處理 Prisma 錯誤
    if (error?.code) {
      switch (error.code) {
        case 'P2002':
          return NextResponse.json({ 
            error: '資料重複',
            details: '請檢查是否已存在相同的記錄'
          }, { status: 409 });
        case 'P2003':
          return NextResponse.json({ 
            error: '關聯資料不存在',
            details: '請確認所有關聯的資料都存在'
          }, { status: 400 });
        case 'P2025':
          return NextResponse.json({ 
            error: '記錄不存在',
            details: '嘗試更新的記錄不存在'
          }, { status: 404 });
        default:
          return NextResponse.json({ 
            error: '資料庫錯誤',
            details: error.message || '請稍後再試'
          }, { status: 500 });
      }
    }
    
    // 處理其他錯誤
    return NextResponse.json({ 
      error: '創建群組預約失敗',
      details: error instanceof Error ? error.message : '未知錯誤，請稍後再試'
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}