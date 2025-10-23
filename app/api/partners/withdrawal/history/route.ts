import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    // 測試資料庫連接
    await prisma.$connect()
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    })

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    // 獲取提領歷史
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: {
        partnerId: partner.id
      },
      orderBy: {
        requestedAt: 'desc'
      }
    })

    return NextResponse.json({
      withdrawals: withdrawals.map(withdrawal => ({
        id: withdrawal.id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt.toISOString(),
        processedAt: withdrawal.processedAt?.toISOString(),
        adminNote: withdrawal.adminNote
      }))
    })

  } catch (error) {
    console.error('獲取提領歷史時發生錯誤:', error)
    
    // 如果是資料庫連接錯誤，返回更友好的錯誤信息
    if (error instanceof Error && error.message.includes('connect')) {
      return NextResponse.json({ 
        error: '資料庫連接失敗，請稍後再試',
        withdrawals: []
      }, { status: 503 })
    }
    
    return NextResponse.json({ 
      error: '獲取提領歷史失敗',
      withdrawals: []
    }, { status: 500 })
  } finally {
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('Database disconnect error:', disconnectError)
    }
  }
}
