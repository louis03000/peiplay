import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log("✅ dashboard api triggered");
  
  // 返回模擬數據，避免資料庫問題
  return NextResponse.json({
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
  });
}
