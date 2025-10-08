import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 預設推薦系統配置
const DEFAULT_REFERRAL_CONFIG = {
  // 原本的平台抽成比例
  ORIGINAL_PLATFORM_FEE: 0.15
};

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
    const referralRecord = partner.referralsReceived[0]; // 假設每個夥伴只有一個推薦人

    if (!referralRecord) {
      // 沒有推薦關係，使用原本的抽成比例
      return NextResponse.json({ 
        message: '無推薦關係，使用原本抽成比例',
        platformFee: DEFAULT_REFERRAL_CONFIG.ORIGINAL_PLATFORM_FEE,
        partnerEarning: booking.finalAmount * (1 - DEFAULT_REFERRAL_CONFIG.ORIGINAL_PLATFORM_FEE),
        referralEarning: 0
      });
    }

    // 獲取邀請人的推薦配置
    const inviter = await prisma.partner.findUnique({
      where: { id: referralRecord.inviterId },
      select: {
        referralPlatformFee: true,
        referralBonusPercentage: true
      }
    });

    if (!inviter) {
      return NextResponse.json({ error: '找不到邀請人' }, { status: 404 });
    }

    // 使用邀請人的動態配置計算推薦收入
    const totalAmount = booking.finalAmount;
    const platformFeePercentage = inviter.referralPlatformFee / 100; // 轉換為小數
    const referralBonusPercentage = inviter.referralBonusPercentage / 100; // 轉換為小數
    
    const referralEarning = totalAmount * referralBonusPercentage;
    const platformFee = totalAmount * platformFeePercentage;
    const partnerEarning = totalAmount - platformFee - referralEarning;

    // 創建推薦收入記錄
    const referralEarningRecord = await prisma.referralEarning.create({
      data: {
        referralRecordId: referralRecord.id,
        bookingId: booking.id,
        amount: referralEarning,
        percentage: inviter.referralBonusPercentage
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
      platformFee: platformFeePercentage,
      partnerEarning,
      referralEarning,
      inviter: {
        id: referralRecord.inviter.id,
        name: referralRecord.inviter.name
      },
      referralEarningRecord,
      config: {
        platformFeePercentage: inviter.referralPlatformFee,
        referralBonusPercentage: inviter.referralBonusPercentage
      }
    });
  } catch (error) {
    console.error('計算推薦收入失敗:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
