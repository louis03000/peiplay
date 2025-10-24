import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('🚀 即時預約 API 開始處理...')
  
  try {
    const { partnerId, duration } = await request.json()
    console.log('📊 請求參數:', { partnerId, duration })

    if (!partnerId || !duration || duration <= 0) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 計算預約時間
    const now = new Date()
    const startTime = new Date(now.getTime() + 15 * 60 * 1000) // 15分鐘後開始
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000) // 加上預約時長

    // 計算費用
    const totalCost = Math.ceil(duration * 20) // 每小時 20 元

    // 返回成功回應
    return NextResponse.json({
      id: 'mock-booking-' + Date.now(),
      message: '即時預約創建成功',
      totalCost: totalCost,
      booking: {
        id: 'mock-booking-' + Date.now(),
        status: 'CONFIRMED',
        orderNumber: `INST-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        duration: duration,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalCost: totalCost
      }
    })

  } catch (error) {
    console.error('即時預約創建失敗:', error)
    return NextResponse.json({ 
      error: '預約創建失敗，請重試',
      success: false
    }, { status: 500 })
  }
}