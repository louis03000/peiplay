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
    console.log("🔐 Session check:", { hasSession: !!session, userId: session?.user?.id });
    
    if (!session?.user?.id) {
      console.log("❌ 未登入");
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 檢查是否為夥伴
    console.log("🔍 查詢夥伴資料...");
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        referralEarnings: true // 夥伴的推薦收入
      }
    });
    
    console.log("👤 夥伴資料:", { partnerId: partner?.id, hasPartner: !!partner });

    if (!partner) {
      console.log("❌ 用戶不是夥伴");
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 });
    }

    // 計算總收入：所有已完成的預約的 finalAmount 總和
    console.log("💰 計算總收入...");
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
    }).catch((err) => {
      console.error("❌ 計算總收入失敗:", err);
      throw new Error("計算總收入時發生錯誤: " + err.message);
    });

    const totalEarnings = totalEarningsResult._sum.finalAmount || 0;
    console.log("✅ 總收入計算完成:", totalEarnings);

    // 計算總接單數
    console.log("📊 計算總接單數...");
    const totalOrders = await prisma.booking.count({
      where: {
        schedule: {
          partnerId: partner.id
        },
        status: {
          in: ['COMPLETED', 'CONFIRMED']
        }
      }
    }).catch((err) => {
      console.error("❌ 計算總接單數失敗:", err);
      throw new Error("計算總接單數時發生錯誤: " + err.message);
    });
    console.log("✅ 總接單數計算完成:", totalOrders);

    // 計算已提領總額
    console.log("💸 計算已提領總額...");
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
    }).catch((err) => {
      console.error("❌ 計算已提領總額失敗:", err);
      throw new Error("計算已提領總額時發生錯誤: " + err.message);
    });

    const totalWithdrawn = totalWithdrawnResult._sum.amount || 0;
    console.log("✅ 已提領總額計算完成:", totalWithdrawn);

    // 計算待審核的提領申請數
    console.log("⏳ 計算待審核的提領申請數...");
    const pendingWithdrawals = await prisma.withdrawalRequest.count({
      where: {
        partnerId: partner.id,
        status: 'PENDING'
      }
    }).catch((err) => {
      console.error("❌ 計算待審核提領申請數失敗:", err);
      throw new Error("計算待審核提領申請數時發生錯誤: " + err.message);
    });
    console.log("✅ 待審核提領申請數計算完成:", pendingWithdrawals);

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

  } catch (error: any) {
    console.error('❌❌❌ 獲取提領統計時發生錯誤:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // 返回更詳細的錯誤訊息給客戶端（僅在開發環境）
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment 
      ? `獲取提領統計失敗: ${error.message}` 
      : '獲取提領統計失敗，請稍後再試';
    
    return NextResponse.json({ 
      error: errorMessage,
      details: isDevelopment ? error.message : undefined
    }, { status: 500 });
  }
}
