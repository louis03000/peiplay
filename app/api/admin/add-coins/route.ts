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

    const { coinAmount = 1000 } = await request.json()
    
    // 使用事務確保資料一致性
    const result = await prisma.$transaction(async (tx) => {
      // 更新或創建用戶金幣記錄
      const updatedCoins = await tx.userCoins.upsert({
        where: { userId: session.user.id },
        update: {
          coinBalance: { increment: coinAmount },
          totalRecharged: { increment: coinAmount }
        },
        create: {
          userId: session.user.id,
          coinBalance: coinAmount,
          totalRecharged: coinAmount
        }
      })

      // 記錄交易
      await tx.coinTransaction.create({
        data: {
          userId: session.user.id,
          transactionType: 'ADMIN_ADD',
          amount: coinAmount,
          description: `管理員添加 ${coinAmount} 金幣（測試用）`,
          balanceBefore: updatedCoins.coinBalance - coinAmount,
          balanceAfter: updatedCoins.coinBalance
        }
      })

      return updatedCoins
    })

    return NextResponse.json({
      success: true,
      message: `成功添加 ${coinAmount} 金幣`,
      coinBalance: result.coinBalance,
      totalRecharged: result.totalRecharged
    })

  } catch (error) {
    console.error('添加金幣失敗:', error)
    return NextResponse.json({ error: '添加金幣失敗' }, { status: 500 })
  }
}
