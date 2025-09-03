import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { coinAmount, paymentMethod = 'ecpay' } = await request.json()
    
    if (!coinAmount || coinAmount <= 0) {
      return NextResponse.json({ error: '請選擇有效的儲值金額' }, { status: 400 })
    }

    // 創建儲值訂單
    const orderNumber = `RECHARGE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const rechargeRecord = await prisma.rechargeRecord.create({
      data: {
        userId: session.user.id,
        coinAmount: coinAmount,
        paymentAmount: coinAmount, // 1金幣 = 1元台幣
        paymentMethod: paymentMethod,
        orderNumber: orderNumber,
        status: 'PENDING'
      }
    })

    // 創建綠界付款請求
    const paymentRes = await fetch(`${process.env.NEXTAUTH_URL}/api/payment/ecpay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: rechargeRecord.id,
        amount: rechargeRecord.paymentAmount,
        description: `儲值 ${coinAmount} 金幣`,
        customerName: session.user.name || 'PeiPlay 用戶',
        customerEmail: session.user.email || 'user@peiplay.com',
        orderNumber: orderNumber
      }),
    })

    if (!paymentRes.ok) {
      const errorData = await paymentRes.json()
      throw new Error(errorData.error || '付款建立失敗')
    }

    const paymentData = await paymentRes.json()

    return NextResponse.json({
      success: true,
      orderId: rechargeRecord.id,
      orderNumber: orderNumber,
      paymentUrl: paymentData.paymentUrl,
      params: paymentData.params
    })

  } catch (error) {
    console.error('儲值失敗:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '儲值失敗，請重試' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 獲取用戶儲值記錄
    const rechargeRecords = await prisma.rechargeRecord.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    return NextResponse.json({
      success: true,
      records: rechargeRecords
    })

  } catch (error) {
    console.error('獲取儲值記錄失敗:', error)
    return NextResponse.json({ error: '獲取儲值記錄失敗' }, { status: 500 })
  }
}
