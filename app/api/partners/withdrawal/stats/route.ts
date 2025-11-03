import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 平台抽成比例
const PLATFORM_FEE_PERCENTAGE = 0.15; // 15%

export async function GET(request: NextRequest) {
  try {
    console.log("✅ partners/withdrawal/stats GET api triggered");
    
    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        referralEarnings: true // 夥伴的推薦收入
      }
    });

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 });
    }

    // 計算總收入：所有已完成的預約的 finalAmount 總和
    const totalEarningsResult = await prisma.booking.aggregate({
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
    });

    const totalEarnings = totalEarningsResult._sum.finalAmount || 0;

    // 計算總接單數
    const totalOrders = await prisma.booking.count({
      where: {
        schedule: {
          partnerId: partner.id
        },
        status: {
          in: ['COMPLETED', 'CONFIRMED']
        }
      }
    });

    // 計算已提領總額
    const totalWithdrawnResult = await prisma.withdrawalRequest.aggregate({
      where: {
        partnerId: partner.id,
        status: {
          in: ['APPROVED', 'COMPLETED']
        }
      },
      _sum: {
        amount: true
      }
    });

    const totalWithdrawn = totalWithdrawnResult._sum.amount || 0;

    // 計算待審核的提領申請數
    const pendingWithdrawals = await prisma.withdrawalRequest.count({
      where: {
        partnerId: partner.id,
        status: 'PENDING'
      }
    });

    // 夥伴的推薦收入（從夥伴資料中獲取）
    const referralEarnings = partner.referralEarnings || 0;

    // 計算可提領餘額：
    // 1. 夥伴收入 = 總收入 * (1 - 平台抽成15%) = 總收入 * 85%
    // 2. 加上推薦收入
    // 3. 減去已提領金額
    const partnerEarnings = totalEarnings * (1 - PLATFORM_FEE_PERCENTAGE);
    const availableBalance = partnerEarnings + referralEarnings - totalWithdrawn;

    console.log('📊 提領統計計算結果:', {
      partnerId: partner.id,
      totalEarnings,
      totalOrders,
      partnerEarnings,
      referralEarnings,
      totalWithdrawn,
      availableBalance,
      pendingWithdrawals
    });

    return NextResponse.json({
      totalEarnings, // 總收入（客戶付的總金額）
      totalOrders,
      availableBalance: Math.max(0, availableBalance), // 確保不會是負數
      pendingWithdrawals,
      referralEarnings
    });

  } catch (error) {
    console.error('獲取提領統計時發生錯誤:', error)
    return NextResponse.json({ error: '獲取提領統計失敗' }, { status: 500 })
  }
}
