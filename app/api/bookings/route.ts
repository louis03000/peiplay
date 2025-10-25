import { NextResponse, NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Handles the creation of new bookings.
 */
export async function POST(request: Request) {
  try {
    console.log("✅ bookings POST api triggered");
    
    const { scheduleIds } = await request.json();

    if (!scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json({ error: 'Valid schedule IDs were not provided' }, { status: 400 });
    }

    // 返回模擬成功響應
    return NextResponse.json({
      id: 'mock-booking-' + Date.now(),
      status: 'CONFIRMED',
      message: '預約創建成功'
    });

  } catch (error) {
    console.error('預約創建失敗:', error);
    return NextResponse.json({ error: '預約創建失敗' }, { status: 500 });
  }
}

/**
 * Fetches bookings based on the user's role.
 */
export async function GET(request: NextRequest) {
  try {
    console.log("✅ bookings GET api triggered");
    
    // 返回模擬預約數據
    const mockBookings = [
      {
        id: 'mock-booking-1',
        status: 'CONFIRMED',
        schedule: {
          id: 'mock-schedule-1',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          partner: {
            name: '測試夥伴'
          }
        },
        customer: {
          name: '測試客戶'
        },
        createdAt: new Date().toISOString()
      }
    ];

    return NextResponse.json({ bookings: mockBookings });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred' },
      { status: 500 }
    );
  }
} 