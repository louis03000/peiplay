import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log('🚀 Simple dashboard API triggered');
  
  try {
    // 不依賴任何外部依賴，直接返回成功
    return NextResponse.json({
      status: 'success',
      message: 'Simple dashboard API is working',
      timestamp: new Date().toISOString(),
      data: {
        partner: {
          id: 'test-partner-id',
          isAvailableNow: true,
          isRankBooster: false,
          allowGroupBooking: true,
          availableNowSince: new Date().toISOString(),
          rankBoosterImages: []
        },
        schedules: [],
        groups: []
      }
    });
    
  } catch (error) {
    console.error('❌ Simple dashboard API error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
