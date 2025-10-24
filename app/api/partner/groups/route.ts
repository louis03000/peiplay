import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 獲取夥伴的群組預約
export async function GET() {
  try {
    console.log('🔍 GET /api/partner/groups 開始處理...')
    
    // 測試資料庫連接
    console.log('🔌 測試資料庫連接...')
    try {
      await prisma.$connect()
      console.log('✅ 資料庫連接成功')
    } catch (dbError) {
      console.error('❌ 資料庫連接失敗:', dbError)
      return NextResponse.json({ 
        error: '資料庫連接失敗，請稍後再試',
        groups: []
      }, { status: 503 })
    }
    
    const session = await getServerSession(authOptions);
    console.log('🔍 會話檢查:', { hasSession: !!session, userId: session?.user?.id })
    if (!session?.user?.id) {
      console.log('❌ 用戶未登入')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    });

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 });
    }

    const groups = await prisma.groupBooking.findMany({
      where: { partnerId: partner.id },
      include: {
        bookings: {
          include: {
            customer: {
              include: { user: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(groups);

  } catch (error) {
    console.error('Error fetching partner groups:', error);
    
    // 如果是資料庫連接錯誤，返回更友好的錯誤信息
    if (error instanceof Error && error.message.includes('connect')) {
      return NextResponse.json({ 
        error: '資料庫連接失敗，請稍後再試',
        groups: []
      }, { status: 503 })
    }
    
    return NextResponse.json({ 
      error: 'Internal Server Error',
      groups: []
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('Database disconnect error:', disconnectError)
    }
  }
}

// 創建新的群組預約
export async function POST(request: Request) {
  try {
    console.log('🚀 開始處理群組預約創建請求...')
    
    // 測試資料庫連接
    console.log('🔌 測試資料庫連接...')
    try {
      await prisma.$connect()
      console.log('✅ 資料庫連接成功')
    } catch (dbError) {
      console.error('❌ 資料庫連接失敗:', dbError)
      return NextResponse.json({ 
        error: '資料庫連接失敗，請稍後再試',
        success: false
      }, { status: 503 })
    }
    
    const session = await getServerSession(authOptions);
    console.log('🔍 會話檢查:', { hasSession: !!session, userId: session?.user?.id })
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 檢查是否為夥伴
    console.log('🔍 檢查夥伴狀態...')
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: { id: true, allowGroupBooking: true }
    });
    console.log('👤 夥伴查詢結果:', { partnerId: partner?.id, allowGroupBooking: partner?.allowGroupBooking })

    if (!partner) {
      console.log('❌ 用戶不是夥伴')
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 });
    }

    if (!partner.allowGroupBooking) {
      console.log('❌ 夥伴未啟用群組預約功能')
      return NextResponse.json({ error: '您尚未啟用群組預約功能' }, { status: 400 });
    }

    console.log('📝 解析請求數據...')
    const { title, description, date, startTime, endTime, pricePerPerson, maxParticipants } = await request.json();
    console.log('📊 請求數據:', { title, description, date, startTime, endTime, pricePerPerson, maxParticipants })

    // 驗證必要欄位
    console.log('✅ 驗證必要欄位...')
    if (!title || !date || !startTime || !endTime || !pricePerPerson || !maxParticipants) {
      console.log('❌ 缺少必要欄位:', { title: !!title, date: !!date, startTime: !!startTime, endTime: !!endTime, pricePerPerson: !!pricePerPerson, maxParticipants: !!maxParticipants })
      return NextResponse.json({ error: '請填寫所有必要欄位' }, { status: 400 });
    }

    if (maxParticipants > 9) {
      console.log('❌ 最大人數超過限制:', maxParticipants)
      return NextResponse.json({ error: '最大人數不能超過9人' }, { status: 400 });
    }

    // 組合開始和結束時間
    console.log('⏰ 處理時間數據...')
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);
    console.log('📅 時間組合結果:', { startDateTime: startDateTime.toISOString(), endDateTime: endDateTime.toISOString() })

    // 檢查時間是否為未來
    const now = new Date()
    console.log('🕐 時間檢查:', { now: now.toISOString(), startDateTime: startDateTime.toISOString(), isFuture: startDateTime > now })
    if (startDateTime <= new Date()) {
      console.log('❌ 開始時間不是未來時間')
      return NextResponse.json({ error: '開始時間必須是未來時間' }, { status: 400 });
    }

    if (startDateTime >= endDateTime) {
      console.log('❌ 開始時間晚於結束時間')
      return NextResponse.json({ error: '開始時間必須早於結束時間' }, { status: 400 });
    }

    // 獲取或創建夥伴的客戶記錄
    console.log('👥 檢查夥伴客戶記錄...')
    let partnerCustomer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });
    console.log('🔍 客戶記錄查詢結果:', { hasCustomer: !!partnerCustomer, customerId: partnerCustomer?.id })

    if (!partnerCustomer) {
      console.log('➕ 創建夥伴客戶記錄...')
      // 如果夥伴沒有客戶記錄，創建一個
      partnerCustomer = await prisma.customer.create({
        data: {
          userId: session.user.id,
          name: session.user.name || '夥伴',
          birthday: new Date('1990-01-01'), // 預設生日
          phone: '0000000000' // 預設電話
        }
      });
      console.log('✅ 客戶記錄創建成功:', { customerId: partnerCustomer.id })
    }

    // 創建群組預約
    console.log('🎯 開始創建群組預約...')
    const groupBookingData = {
      partnerId: partner.id,
      creatorId: partnerCustomer.id, // 夥伴的客戶記錄作為創建者
      title,
      description: description || null,
      maxParticipants,
      currentParticipants: 1, // 夥伴自己算1人
      pricePerPerson,
      startTime: startDateTime,
      endTime: endDateTime,
      status: 'ACTIVE' as any, // 明確指定為枚舉值
      // 這裡可以添加 Discord 頻道相關的欄位
      discordTextChannelId: null,
      discordVoiceChannelId: null
    }
    console.log('📋 群組預約數據:', groupBookingData)
    
    const groupBooking = await prisma.groupBooking.create({
      data: groupBookingData,
      include: {
        partner: {
          select: { name: true }
        }
      }
    });
    console.log('✅ 群組預約創建成功:', { groupBookingId: groupBooking.id })

    return NextResponse.json({
      success: true,
      groupBooking
    });

  } catch (error) {
    console.error('Error creating group booking:', error);
    
    // 如果是資料庫連接錯誤，返回更友好的錯誤信息
    if (error instanceof Error && error.message.includes('connect')) {
      return NextResponse.json({ 
        error: '資料庫連接失敗，請稍後再試',
        success: false
      }, { status: 503 })
    }
    
    return NextResponse.json({ 
      error: 'Internal Server Error',
      success: false
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('Database disconnect error:', disconnectError)
    }
  }
}
