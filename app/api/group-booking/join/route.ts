import { NextResponse } from "next/server";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 加入群組預約
export async function POST(request: Request) {
  try {
    console.log("✅ group-booking/join POST api triggered");
    
    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { groupBookingId } = await request.json();

    if (!groupBookingId) {
      return NextResponse.json({ error: '缺少群組預約 ID' }, { status: 400 });
    }

    // 確保資料庫連線
    await prisma.$connect();

    // 查找群組預約
    const groupBooking = await prisma.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: {
        GroupBookingParticipant: true
      }
    });

    if (!groupBooking) {
      return NextResponse.json({ error: '群組預約不存在' }, { status: 404 });
    }

    if (groupBooking.status !== 'ACTIVE') {
      return NextResponse.json({ error: '群組預約已關閉' }, { status: 400 });
    }

    if (groupBooking.GroupBookingParticipant.length >= groupBooking.maxParticipants) {
      return NextResponse.json({ error: '群組預約已滿' }, { status: 400 });
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
          birthday: new Date('1990-01-01'),
          phone: '0000000000'
        }
      });
    }

    // 檢查是否已經加入
    const existingParticipant = await prisma.groupBookingParticipant.findFirst({
      where: {
        groupBookingId: groupBookingId,
        customerId: customer.id
      }
    });

    if (existingParticipant) {
      return NextResponse.json({ error: '您已經加入此群組預約' }, { status: 400 });
    }

    // 創建群組參與者記錄
    const participant = await prisma.groupBookingParticipant.create({
      data: {
        id: `gbp-${groupBookingId}-${customer.id}`,
        groupBookingId: groupBookingId,
        customerId: customer.id,
        status: 'ACTIVE'
      }
    });

    // 更新群組預約的當前參與人數
    await prisma.groupBooking.update({
      where: { id: groupBookingId },
      data: { 
        currentParticipants: groupBooking.GroupBookingParticipant.length + 1
      }
    });

    // 創建 Booking 記錄（用於顯示在「我的預約」中）
    const booking = await prisma.booking.create({
      data: {
        id: `booking-${Date.now()}`,
        customerId: customer.id,
        status: 'CONFIRMED',
        originalAmount: groupBooking.pricePerPerson || 0,
        finalAmount: groupBooking.pricePerPerson || 0,
        isGroupBooking: true,
        groupBookingId: groupBookingId,
        schedule: {
          create: {
            partnerId: groupBooking.initiatorId,
            date: groupBooking.date,
            startTime: groupBooking.startTime,
            endTime: groupBooking.endTime,
            isAvailable: false
          }
        }
      },
      include: {
        schedule: {
          include: {
            partner: {
              select: { name: true }
            }
          }
        }
      }
    });

    console.log("✅ 成功加入群組預約:", groupBookingId);

    return NextResponse.json({
      success: true,
      message: '成功加入群組預約',
      groupBooking: {
        id: groupBooking.id,
        title: groupBooking.title,
        description: groupBooking.description,
        maxParticipants: groupBooking.maxParticipants,
        currentParticipants: groupBooking.GroupBookingParticipant.length + 1,
        pricePerPerson: groupBooking.pricePerPerson,
        status: groupBooking.status,
        startTime: groupBooking.startTime.toISOString(),
        endTime: groupBooking.endTime.toISOString()
      },
      booking: {
        id: booking.id,
        status: booking.status,
        createdAt: booking.createdAt.toISOString()
      }
    });

  } catch (error) {
    console.error('❌ 加入群組預約失敗:', error);
    return NextResponse.json({ 
      error: '加入群組預約失敗',
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