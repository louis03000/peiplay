import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 加入群組預約
export async function POST(request: Request) {
  try {
    console.log("✅ group-booking/join POST api triggered");
    
    const { groupBookingId } = await request.json();

    if (!groupBookingId) {
      return NextResponse.json({ error: '缺少群組預約 ID' }, { status: 400 });
    }

    // 返回模擬成功響應
    const mockGroupBooking = {
      id: groupBookingId,
      partnerId: 'mock-partner-1',
      title: 'LOL 上分團',
      description: '一起上分，互相學習',
      maxParticipants: 4,
      currentParticipants: 3, // 模擬增加一人
      pricePerPerson: 100,
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    const mockBooking = {
      id: 'mock-booking-' + Date.now(),
      customerId: 'mock-customer-1',
      status: 'CONFIRMED',
      originalAmount: 0,
      finalAmount: 0,
      isGroupBooking: true,
      groupBookingId: groupBookingId,
      createdAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: '成功加入群組預約',
      groupBooking: mockGroupBooking,
      booking: mockBooking
    });

  } catch (error) {
    console.error('加入群組預約失敗:', error);
    return NextResponse.json({ error: '加入群組預約失敗' }, { status: 500 });
  }
}
