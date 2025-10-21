import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// 加入群組預約
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { groupBookingId } = await request.json();

    if (!groupBookingId) {
      return NextResponse.json({ error: '缺少群組預約 ID' }, { status: 400 });
    }

    // 獲取客戶資訊
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 獲取群組預約資訊
    const groupBooking = await prisma.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: {
        partner: true,
        bookings: {
          include: {
            customer: true
          }
        }
      }
    });

    if (!groupBooking) {
      return NextResponse.json({ error: '群組預約不存在' }, { status: 404 });
    }

    if (groupBooking.status !== 'ACTIVE') {
      return NextResponse.json({ error: '群組預約已結束或已取消' }, { status: 400 });
    }

    // 檢查是否在開始前30分鐘內
    const now = new Date();
    const thirtyMinutesBeforeStart = new Date(groupBooking.startTime.getTime() - 30 * 60 * 1000);
    if (now >= thirtyMinutesBeforeStart) {
      return NextResponse.json({ error: '群組已關閉報名' }, { status: 400 });
    }

    // 檢查是否已經加入
    const existingBooking = groupBooking.bookings.find(
      booking => booking.customerId === customer.id
    );

    if (existingBooking) {
      return NextResponse.json({ error: '您已經加入此群組預約' }, { status: 400 });
    }

    // 檢查是否已滿員
    if (groupBooking.currentParticipants >= groupBooking.maxParticipants) {
      return NextResponse.json({ error: '群組預約已滿員' }, { status: 400 });
    }

    // 使用事務加入群組
    const result = await prisma.$transaction(async (tx) => {
      // 更新群組預約的參與人數
      const updatedGroupBooking = await tx.groupBooking.update({
        where: { id: groupBookingId },
        data: {
          currentParticipants: { increment: 1 },
          status: groupBooking.currentParticipants + 1 >= groupBooking.maxParticipants ? 'FULL' : 'ACTIVE'
        }
      });

      // 為新成員創建預約記錄
      const booking = await tx.booking.create({
        data: {
          customerId: customer.id,
          scheduleId: '', // 群組預約暫時不需要 schedule
          status: 'CONFIRMED',
          originalAmount: 0,
          finalAmount: 0,
          isGroupBooking: true,
          groupBookingId: groupBookingId,
          paymentInfo: {
            type: 'group_booking',
            groupBookingId: groupBookingId,
            isCreator: false
          }
        }
      });

      return { updatedGroupBooking, booking };
    });

    return NextResponse.json({
      success: true,
      message: '成功加入群組預約',
      groupBooking: result.updatedGroupBooking,
      booking: result.booking
    });

  } catch (error) {
    console.error('加入群組預約失敗:', error);
    return NextResponse.json({ error: '加入群組預約失敗' }, { status: 500 });
  }
}
