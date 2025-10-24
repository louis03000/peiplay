import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      include: { user: true }
    })

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    // 計算總收入和總接單數
    const [totalEarnings, totalOrders, pendingWithdrawals] = await Promise.all([
      // 總收入（已完成和已確認的預約）
      prisma.booking.aggregate({
        where: {
          schedule: {
            partnerId: partner.id
          },
          status: {
            in: ['COMPLETED', 'CONFIRMED']
          }
        },
        _sum: {
          finalAmount: true
        }
      }),
      // 總接單數
      prisma.booking.count({
        where: {
          schedule: {
            partnerId: partner.id
          },
          status: {
            in: ['COMPLETED', 'CONFIRMED']
          }
        }
      }),
      // 待審核的提領申請
      prisma.withdrawalRequest.count({
        where: {
          partnerId: partner.id,
          status: 'PENDING' as any
        }
      })
    ])

    // 計算已提領總額
    const totalWithdrawn = await prisma.withdrawalRequest.aggregate({
      where: {
        partnerId: partner.id,
        status: {
          in: ['APPROVED', 'COMPLETED'] as any
        }
      },
      _sum: {
        amount: true
      }
    })

    // 計算推薦收入
    const referralEarnings = await prisma.referralEarning.aggregate({
      where: {
        referralRecord: {
          inviterId: partner.id
        }
      },
      _sum: {
        amount: true
      }
    })

    const totalEarningsAmount = totalEarnings._sum.finalAmount || 0
    const totalWithdrawnAmount = totalWithdrawn._sum.amount || 0
    const referralEarningsAmount = referralEarnings._sum.amount || 0
    const availableBalance = totalEarningsAmount + referralEarningsAmount - totalWithdrawnAmount

    return NextResponse.json({
      totalEarnings: totalEarningsAmount,
      totalOrders: totalOrders,
      availableBalance: Math.max(0, availableBalance), // 確保不會是負數
      pendingWithdrawals: pendingWithdrawals,
      referralEarnings: referralEarningsAmount
    })

  } catch (error) {
    console.error('獲取提領統計時發生錯誤:', error)
    return NextResponse.json({ error: '獲取提領統計失敗' }, { status: 500 })
  }
}
