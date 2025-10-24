import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log("✅ bookings api triggered");
  
  // 返回模擬數據，避免資料庫問題
  return NextResponse.json({ 
    bookings: [
      {
        id: 'mock-booking-1',
        status: 'PENDING',
        schedule: {
          id: 'mock-schedule-1',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          partner: {
            name: '測試夥伴'
          }
        }
      }
    ]
  });
}