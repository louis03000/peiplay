import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log('🚀 Simple partner dashboard API triggered');
  
  try {
    // 直接返回模擬數據，不依賴認證
    const mockData = {
      partner: {
        id: 'mock-partner-id',
        isAvailableNow: true,
        isRankBooster: false,
        allowGroupBooking: true,
        availableNowSince: new Date().toISOString(),
        rankBoosterImages: []
      },
      schedules: [
        {
          id: 'mock-schedule-1',
          date: new Date().toISOString(),
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          isAvailable: true,
          booked: false
        }
      ],
      groups: []
    };
    
    console.log('✅ Simple dashboard returning mock data');
    return NextResponse.json(mockData);
    
  } catch (error) {
    console.error('❌ Simple dashboard API error:', error);
    return NextResponse.json({
      error: 'Internal Server Error',
      partner: null,
      schedules: [],
      groups: []
    }, { status: 500 });
  }
}
