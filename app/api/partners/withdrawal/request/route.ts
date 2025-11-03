import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
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

    const { amount } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '請輸入有效的提領金額' }, { status: 400 })
    }

    // 平台抽成比例
    const PLATFORM_FEE_PERCENTAGE = 0.15; // 15%

    // 計算可提領餘額
    const [totalEarnings, totalWithdrawn] = await Promise.all([
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
      prisma.withdrawalRequest.aggregate({
        where: {
          partnerId: partner.id,
          status: {
            in: ['APPROVED', 'COMPLETED']
          }
        },
        _sum: {
          amount: true
        }
      })
    ])

    const totalEarningsAmount = totalEarnings._sum.finalAmount || 0
    const totalWithdrawnAmount = totalWithdrawn._sum.amount || 0
    
    // 獲取夥伴的推薦收入
    const partnerData = await prisma.partner.findUnique({
      where: { id: partner.id },
      select: { referralEarnings: true }
    });
    const referralEarnings = partnerData?.referralEarnings || 0;

    // 計算可提領餘額：
    // 1. 夥伴收入 = 總收入 * (1 - 平台抽成15%) = 總收入 * 85%
    // 2. 加上推薦收入
    // 3. 減去已提領金額
    const partnerEarnings = totalEarningsAmount * (1 - PLATFORM_FEE_PERCENTAGE);
    const availableBalance = partnerEarnings + referralEarnings - totalWithdrawnAmount;

    if (amount > availableBalance) {
      return NextResponse.json({ 
        error: `提領金額不能超過可用餘額 NT$ ${availableBalance.toLocaleString()}` 
      }, { status: 400 })
    }

    // 檢查是否有待審核的提領申請
    const pendingWithdrawals = await prisma.withdrawalRequest.count({
      where: {
        partnerId: partner.id,
        status: 'PENDING'
      }
    })

    if (pendingWithdrawals > 0) {
      return NextResponse.json({ 
        error: '您已有待審核的提領申請，請等待審核完成後再申請' 
      }, { status: 400 })
    }

    // 創建提領申請
    const withdrawalRequest = await prisma.withdrawalRequest.create({
      data: {
        partnerId: partner.id,
        amount: amount,
        status: 'PENDING',
        requestedAt: new Date()
      }
    })

    // 獲取夥伴的詳細統計資料用於通知管理員
    const [totalOrders, recentBookings] = await Promise.all([
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
      prisma.booking.findMany({
        where: {
          schedule: {
            partnerId: partner.id
          },
          status: {
            in: ['COMPLETED', 'CONFIRMED']
          }
        },
        include: {
          customer: {
            include: {
              user: true
            }
          },
          schedule: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5 // 最近5筆訂單
      })
    ])

    // 這裡可以添加通知管理員的邏輯
    // 例如發送 Discord 通知或 email
    console.log('💰 新的提領申請:', {
      partnerId: partner.id,
      partnerName: partner.name,
      amount: amount,
      totalEarnings: totalEarningsAmount,
      totalOrders: totalOrders,
      availableBalance: availableBalance,
      recentBookings: recentBookings.map(b => ({
        orderNumber: b.orderNumber,
        customerName: b.customer.user.name,
        amount: b.finalAmount,
        date: b.createdAt
      }))
    })

    return NextResponse.json({
      success: true,
      withdrawalRequest: {
        id: withdrawalRequest.id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        requestedAt: withdrawalRequest.requestedAt.toISOString()
      },
      message: '提領申請已提交，管理員將盡快審核'
    })

  } catch (error) {
    console.error('提領申請時發生錯誤:', error)
    return NextResponse.json({ error: '提領申請失敗' }, { status: 500 })
  }
}
