import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log("✅ partners/self GET api triggered");
    
    // 返回模擬夥伴數據
    const mockPartner = {
      id: 'mock-partner-1',
      userId: 'mock-user-1',
      name: '測試夥伴',
      games: ['LOL', 'Valorant'],
      halfHourlyRate: 100,
      isAvailableNow: true,
      isRankBooster: false,
      allowGroupBooking: true,
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return NextResponse.json({ partner: mockPartner })
  } catch (error) {
    console.error('Partners self GET error:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      partner: null 
    }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    console.log("✅ partners/self PATCH api triggered");
    
    const { isAvailableNow, isRankBooster, allowGroupBooking, rankBoosterNote, rankBoosterRank, customerMessage, availableNowSince } = await request.json();
    
    // 返回模擬更新後的夥伴數據
    const mockPartner = {
      id: 'mock-partner-1',
      userId: 'mock-user-1',
      name: '測試夥伴',
      games: ['LOL', 'Valorant'],
      halfHourlyRate: 100,
      isAvailableNow: isAvailableNow !== undefined ? isAvailableNow : true,
      isRankBooster: isRankBooster !== undefined ? isRankBooster : false,
      allowGroupBooking: allowGroupBooking !== undefined ? allowGroupBooking : true,
      rankBoosterNote: rankBoosterNote || null,
      rankBoosterRank: rankBoosterRank || null,
      customerMessage: customerMessage || null,
      availableNowSince: availableNowSince ? new Date(availableNowSince).toISOString() : null,
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return NextResponse.json({ partner: mockPartner })
  } catch (error) {
    console.error('Partners self PATCH error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
} 