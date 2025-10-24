import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log("✅ bookings/partner GET api triggered");
    
    // 返回模擬預約數據
    const mockBookings = [
      {
        id: 'mock-booking-1',
        status: 'CONFIRMED',
        originalAmount: 200,
        finalAmount: 200,
        createdAt: new Date().toISOString(),
        customer: {
          name: '測試客戶'
        },
        schedule: {
          id: 'mock-schedule-1',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString()
        }
      }
    ];
    
    return NextResponse.json({ bookings: mockBookings });
  } catch (error) {
    console.error('Bookings partner GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 