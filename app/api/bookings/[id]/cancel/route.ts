import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log("✅ bookings cancel POST api triggered");
    
    const bookingId = params.id;
    
    if (!bookingId) {
      return NextResponse.json({ error: '預約 ID 是必需的' }, { status: 400 });
    }

    // 返回模擬成功響應
    const mockBooking = {
      id: bookingId,
      status: 'CANCELLED',
      customerId: 'mock-customer-1',
      scheduleId: 'mock-schedule-1',
      originalAmount: 200,
      finalAmount: 200,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({ 
      success: true, 
      message: '預約已成功取消',
      booking: mockBooking 
    });

  } catch (error) {
    console.error('取消預約時發生錯誤:', error);
    return NextResponse.json(
      { error: '取消預約失敗，請稍後再試' },
      { status: 500 }
    );
  }
} 