import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 預設推薦系統配置
const DEFAULT_REFERRAL_CONFIG = {
  // 原本的平台抽成比例
  ORIGINAL_PLATFORM_FEE: 0.15,
  // 階梯式推薦獎勵比例（從平台抽成中分配）
  TIERED_REFERRAL_RATES: {
    1: 0.02,  // 1-3人：2%
    3: 0.03,  // 4-10人：3%
    10: 0.04  // 10人以上：4%
  }
};

// 計算階梯式推薦獎勵比例
function calculateTieredReferralRate(referralCount: number): number {
  if (referralCount <= 3) {
    return DEFAULT_REFERRAL_CONFIG.TIERED_REFERRAL_RATES[1]; // 2%
  } else if (referralCount <= 10) {
    return DEFAULT_REFERRAL_CONFIG.TIERED_REFERRAL_RATES[3]; // 3%
  } else {
    return DEFAULT_REFERRAL_CONFIG.TIERED_REFERRAL_RATES[10]; // 4%
  }
}

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();
    
    if (!bookingId) {
      return NextResponse.json({ error: '缺少預約ID' }, { status: 400 });
    }

    // 獲取預約資訊
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        schedule: {
          include: {
            partner: {
              include: {
                referralsReceived: {
                  include: {
                    inviter: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!booking) {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 });
    }

    if (!booking.schedule?.partner) {
      return NextResponse.json({ error: '找不到對應的夥伴' }, { status: 404 });
    }

    const partner = booking.schedule.partner;
    const referralRecord = partner.referralsReceived; // 推薦記錄

    if (!referralRecord) {
      // 沒有推薦關係，使用原本的抽成比例
      return NextResponse.json({ 
        message: '無推薦關係，使用原本抽成比例',
        platformFee: DEFAULT_REFERRAL_CONFIG.ORIGINAL_PLATFORM_FEE,
        partnerEarning: booking.finalAmount * (1 - DEFAULT_REFERRAL_CONFIG.ORIGINAL_PLATFORM_FEE),
        referralEarning: 0
      });
    }

    // 獲取邀請人資訊和推薦統計
    const inviter = await prisma.partner.findUnique({
      where: { id: referralRecord.inviterId },
      select: {
        id: true,
        name: true,
        referralCount: true
      }
    });

    if (!inviter) {
      return NextResponse.json({ error: '找不到邀請人' }, { status: 404 });
    }

    // 使用階梯式推薦系統計算推薦收入
    const totalAmount = booking.finalAmount;
    const platformFeePercentage = DEFAULT_REFERRAL_CONFIG.ORIGINAL_PLATFORM_FEE; // 平台抽成依然是 15%
    const referralBonusPercentage = calculateTieredReferralRate(inviter.referralCount); // 根據推薦人數計算獎勵比例
    
    // 推薦獎勵從平台抽成中分配，不影響被推薦人的收入
    const platformFee = totalAmount * platformFeePercentage; // 平台抽成 15%
    const referralEarning = totalAmount * referralBonusPercentage; // 從平台抽成中分配給推薦人
    const actualPlatformFee = platformFee - referralEarning; // 平台實際收入
    const partnerEarning = totalAmount - platformFee; // 被推薦人收入不受影響

    // 創建推薦收入記錄
    const referralEarningRecord = await prisma.referralEarning.create({
      data: {
        referralRecordId: referralRecord.id,
        bookingId: booking.id,
        amount: referralEarning,
        percentage: referralBonusPercentage * 100 // 轉換為百分比
      }
    });

    // 更新邀請人的推薦收入
    await prisma.partner.update({
      where: { id: referralRecord.inviterId },
      data: {
        referralEarnings: {
          increment: referralEarning
        },
        totalReferralEarnings: {
          increment: referralEarning
        }
      }
    });

    return NextResponse.json({
      message: '推薦收入計算完成',
      totalAmount,
      platformFee: platformFeePercentage,
      actualPlatformFee,
      partnerEarning,
      referralEarning,
      inviter: {
        id: inviter.id,
        name: inviter.name,
        referralCount: inviter.referralCount
      },
      referralEarningRecord,
      tieredRate: {
        percentage: referralBonusPercentage * 100,
        tier: inviter.referralCount <= 3 ? '1-3人' : inviter.referralCount <= 10 ? '4-10人' : '10人以上'
      }
    });
  } catch (error) {
    console.error('計算推薦收入失敗:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
