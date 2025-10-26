import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('🚀 即時預約 API 開始處理...')
  
  try {
    // 檢查認證
    const session = await getServerSession(authOptions);
    console.log('🔐 Session:', session ? 'Found' : 'Not found');
    
    if (!session?.user?.id) {
      console.log('❌ 未登入');
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const requestData = await request.json();
    const { partnerId, duration } = requestData
    console.log('📊 請求參數:', { partnerId, duration, userId: session.user.id })

    if (!partnerId || !duration || duration <= 0) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 暫時返回成功，不操作資料庫
    console.log("✅ 即時預約創建成功 (測試模式)");

    return NextResponse.json({
      id: 'test-' + Date.now(),
      message: '即時預約創建成功',
      totalCost: duration * 1000,
      booking: {
        id: 'test-' + Date.now(),
        status: 'CONFIRMED',
        orderNumber: `INST-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        duration: duration,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + duration * 60 * 60 * 1000).toISOString(),
        totalCost: duration * 1000
      }
    })

  } catch (error) {
    console.error('❌ 即時預約創建失敗:', error)
    
    return NextResponse.json({
      error: '即時預約創建失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
