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
      customer = await prisma.customer.create({
        data: {
          id: `customer-${session.user.id}`,
          userId: session.user.id,
          name: user.name || '未知客戶',
          birthday: new Date('1990-01-01'), // 默認生日
          phone: '0000000000' // 默認電話
        }
      });
    }

    // 創建群組預約
    const startTime = new Date(`${data.date}T${data.startTime}`);
    const endTime = new Date(`${data.date}T${data.endTime}`);

    const groupBooking = await prisma.groupBooking.create({
      data: {
        id: `gb-${Date.now()}`,
        type: 'PARTNER_INITIATED',
        title: data.title,
        description: data.description || null,
        date: startTime,
        startTime: startTime,
        endTime: endTime,
        maxParticipants: data.maxParticipants || 4,
        currentParticipants: 0,
        pricePerPerson: data.pricePerPerson,
        status: 'ACTIVE',
        initiatorId: partner.id,
        initiatorType: 'PARTNER'
      }
    });

    // 創建群組參與者記錄（發起者）
    await prisma.groupBookingParticipant.create({
      data: {
        id: `gbp-${groupBooking.id}-${partner.id}`,
        groupBookingId: groupBooking.id,
        customerId: customer.id,
        partnerId: partner.id,
        status: 'ACTIVE'
      }
    });

    // 更新群組預約的當前參與人數
    await prisma.groupBooking.update({
      where: { id: groupBooking.id },
      data: { currentParticipants: 1 }
    });

    // 確保夥伴的 allowGroupBooking 狀態為 true
    await prisma.partner.update({
      where: { id: partner.id },
      data: { allowGroupBooking: true }
    });

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
        startTime: groupBooking.startTime.toISOString(),
        endTime: groupBooking.endTime.toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ 創建群組預約失敗:', error);
    return NextResponse.json({ 
      error: '創建群組預約失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}