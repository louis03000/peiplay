import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log("✅ partners/withdrawal/stats GET api triggered");
    
    // 返回模擬提領統計數據
    return NextResponse.json({
      totalEarnings: 10000,
      totalOrders: 25,
      availableBalance: 7500,
      pendingWithdrawals: 1,
      referralEarnings: 500
    })

  } catch (error) {
    console.error('獲取提領統計時發生錯誤:', error)
    return NextResponse.json({ error: '獲取提領統計失敗' }, { status: 500 })
  }
}
