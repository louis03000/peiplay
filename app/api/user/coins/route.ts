import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 獲取或創建用戶金幣記錄
    let userCoins = await prisma.userCoins.findUnique({
      where: { userId: session.user.id }
    })

    if (!userCoins) {
      userCoins = await prisma.userCoins.create({
        data: {
          userId: session.user.id,
          coinBalance: 0,
          totalRecharged: 0
        }
      })
    }

    // 獲取最近的交易記錄
    const recentTransactions = await prisma.coinTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    return NextResponse.json({
      success: true,
      coinBalance: userCoins.coinBalance,
      totalRecharged: userCoins.totalRecharged,
      recentTransactions: recentTransactions
    })

  } catch (error) {
    console.error('獲取金幣資訊失敗:', error)
    return NextResponse.json({ error: '獲取金幣資訊失敗' }, { status: 500 })
  }
}
