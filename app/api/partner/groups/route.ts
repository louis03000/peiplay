import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取夥伴的群組預約
export async function GET() {
  console.log('🔍 GET /api/partner/groups 開始處理...')
  
  // 返回模擬數據
  return NextResponse.json([
    {
      id: 'mock-group-1',
      title: '測試群組',
      description: '這是一個測試群組',
      maxParticipants: 4,
      currentParticipants: 1,
      pricePerPerson: 100,
      status: 'ACTIVE',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()
    }
  ]);
}

// 創建新的群組預約
export async function POST(request: Request) {
  console.log('🚀 開始處理群組預約創建請求...')
  
  try {
    const data = await request.json();
    console.log('📊 請求數據:', data);
    
    // 返回成功回應
    return NextResponse.json({
      success: true,
      groupBooking: {
        id: 'mock-group-' + Date.now(),
        title: data.title,
        description: data.description,
        maxParticipants: data.maxParticipants,
        currentParticipants: 1,
        pricePerPerson: data.pricePerPerson,
        status: 'ACTIVE',
        startTime: new Date(`${data.date}T${data.startTime}`).toISOString(),
        endTime: new Date(`${data.date}T${data.endTime}`).toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error creating group booking:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      success: false
    }, { status: 500 });
  }
}
