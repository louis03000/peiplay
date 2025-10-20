import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// 創建群組預約
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { partnerId, title, description, maxParticipants, startTime, endTime } = await request.json();

    if (!partnerId || !title || !startTime || !endTime) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 檢查夥伴是否存在且允許群組預約
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: { user: true }
    });

    if (!partner) {
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 });
    }

    if (!partner.allowGroupBooking) {
      return NextResponse.json({ error: '此夥伴不支援群組預約' }, { status: 400 });
    }

    // 獲取客戶資訊
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 檢查時間衝突
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (start >= end) {
      return NextResponse.json({ error: '開始時間必須早於結束時間' }, { status: 400 });
    }

    if (start <= new Date()) {
      return NextResponse.json({ error: '開始時間必須是未來時間' }, { status: 400 });
    }

    // 檢查夥伴在該時段是否有其他預約
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        schedule: {
          partnerId: partnerId,
          startTime: { lt: end },
          endTime: { gt: start }
        },
        status: { notIn: ['CANCELLED', 'REJECTED'] }
      }
    });

    if (conflictingBookings.length > 0) {
      return NextResponse.json({ error: '該時段已被預約' }, { status: 409 });
    }

    // 創建群組預約
    const groupBooking = await prisma.groupBooking.create({
      data: {
        partnerId,
        creatorId: customer.id,
        title,
        description: description || null,
        maxParticipants: maxParticipants || 4,
        currentParticipants: 1,
        startTime: start,
        endTime: end,
        status: 'ACTIVE'
      },
      include: {
        partner: {
          include: { user: true }
        },
        creator: {
          include: { user: true }
        }
      }
    });

    // 為創建者創建預約記錄
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        scheduleId: '', // 群組預約暫時不需要 schedule
        status: 'CONFIRMED',
        originalAmount: 0,
        finalAmount: 0,
        isGroupBooking: true,
        groupBookingId: groupBooking.id,
        paymentInfo: {
          type: 'group_booking',
          groupBookingId: groupBooking.id,
          isCreator: true
        }
      }
    });

    return NextResponse.json({
      success: true,
      groupBooking,
      booking
    });

  } catch (error) {
    console.error('創建群組預約失敗:', error);
    return NextResponse.json({ error: '創建群組預約失敗' }, { status: 500 });
  }
}

// 獲取群組預約列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    const status = searchParams.get('status');

    const where: any = {};
    if (partnerId) where.partnerId = partnerId;
    if (status) where.status = status;

    const groupBookings = await prisma.groupBooking.findMany({
      where,
      include: {
        partner: {
          include: { user: true }
        },
        creator: {
          include: { user: true }
        },
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

    return NextResponse.json(groupBookings);

  } catch (error) {
    console.error('獲取群組預約失敗:', error);
    return NextResponse.json({ error: '獲取群組預約失敗' }, { status: 500 });
  }
}
