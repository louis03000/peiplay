import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const DEFAULT_REFERRAL_CONFIG = {
  ORIGINAL_PLATFORM_FEE: 0.15,
  TIERED_REFERRAL_RATES: {
    1: 0.02,
    3: 0.03,
    10: 0.04,
  },
};

function calculateTieredReferralRate(referralCount: number): number {
  if (referralCount <= 3) {
    return DEFAULT_REFERRAL_CONFIG.TIERED_REFERRAL_RATES[1];
  } else if (referralCount <= 10) {
    return DEFAULT_REFERRAL_CONFIG.TIERED_REFERRAL_RATES[3];
  } else {
    return DEFAULT_REFERRAL_CONFIG.TIERED_REFERRAL_RATES[10];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();

    if (!bookingId) {
      return NextResponse.json({ error: '缺少預約ID' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      const booking = await client.booking.findUnique({
        where: { id: bookingId },
        include: {
          schedule: {
            include: {
              partner: {
                include: {
                  referralsReceived: {
                    include: {
                      inviter: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!booking) {
        return { type: 'BOOKING_NOT_FOUND' } as const;
      }

      if (!booking.schedule?.partner) {
        return { type: 'PARTNER_NOT_FOUND' } as const;
      }

      const partner = booking.schedule.partner;
      const referralRecord = partner.referralsReceived;

      // 🔥 添加调试日志
      console.log(`🔍 計算推薦收入: 預約 ${bookingId}, 夥伴 ${partner.id} (${partner.name})`);
      console.log(`   預約狀態: ${booking.status}, 金額: ${booking.finalAmount}`);
      console.log(`   推薦記錄: ${referralRecord ? '存在' : '不存在'}`);

      if (!referralRecord) {
        console.log(`⚠️ 夥伴 ${partner.id} 沒有推薦記錄，跳過推薦收入計算`);
        const partnerEarning = booking.finalAmount * (1 - DEFAULT_REFERRAL_CONFIG.ORIGINAL_PLATFORM_FEE);

        return {
          type: 'NO_REFERRAL',
          payload: {
            message: '無推薦關係，使用原本抽成比例',
            platformFee: DEFAULT_REFERRAL_CONFIG.ORIGINAL_PLATFORM_FEE,
            partnerEarning,
            referralEarning: 0,
          },
        } as const;
      }

      console.log(`✅ 找到推薦記錄: 推薦人 ${referralRecord.inviterId}, 被推薦人 ${referralRecord.inviteeId}`);

      const inviter = await client.partner.findUnique({
        where: { id: referralRecord.inviterId },
        select: {
          id: true,
          name: true,
          referralCount: true,
        },
      });

      if (!inviter) {
        return { type: 'INVITER_NOT_FOUND' } as const;
      }

      const totalAmount = booking.finalAmount || 0;
      
      // 🔥 如果金額為 0，記錄警告但不計算推薦收入
      if (totalAmount === 0 || totalAmount === null) {
        console.warn(`⚠️ 預約 ${bookingId} 金額為 0 或 null，跳過推薦收入計算`);
        return {
          type: 'ZERO_AMOUNT',
          payload: {
            message: '預約金額為 0，無法計算推薦收入',
            referralEarning: 0,
          },
        } as const;
      }

      const platformFeePercentage = DEFAULT_REFERRAL_CONFIG.ORIGINAL_PLATFORM_FEE;
      const referralBonusPercentage = calculateTieredReferralRate(inviter.referralCount);

      const platformFee = totalAmount * platformFeePercentage;
      const referralEarning = totalAmount * referralBonusPercentage;
      const actualPlatformFee = platformFee - referralEarning;
      const partnerEarning = totalAmount - platformFee;

      console.log(`💰 推薦收入計算: 總金額 ${totalAmount}, 推薦比例 ${referralBonusPercentage * 100}%, 推薦收入 ${referralEarning}`);

      // 🔥 檢查是否已經計算過推薦收入（防止重複計算）
      const existingEarning = await client.referralEarning.findFirst({
        where: {
          bookingId: booking.id,
        },
      });

      if (existingEarning) {
        console.log(`⚠️ 預約 ${booking.id} 的推薦收入已計算過，跳過重複計算`);
        return {
          type: 'ALREADY_CALCULATED',
          payload: {
            message: '推薦收入已計算過',
            referralEarning: existingEarning.amount,
            existingRecord: existingEarning,
          },
        } as const;
      }

      const referralEarningRecord = await client.referralEarning.create({
        data: {
          referralRecordId: referralRecord.id,
          bookingId: booking.id,
          amount: referralEarning,
          percentage: referralBonusPercentage * 100,
        },
      });

      await client.partner.update({
        where: { id: referralRecord.inviterId },
        data: {
          referralEarnings: {
            increment: referralEarning,
          },
          totalReferralEarnings: {
            increment: referralEarning,
          },
        },
      });

      return {
        type: 'SUCCESS',
        payload: {
          message: '推薦收入計算完成',
          totalAmount,
          platformFee: platformFeePercentage,
          actualPlatformFee,
          partnerEarning,
          referralEarning,
          inviter: {
            id: inviter.id,
            name: inviter.name,
            referralCount: inviter.referralCount,
          },
          referralEarningRecord,
          tieredRate: {
            percentage: referralBonusPercentage * 100,
            tier: inviter.referralCount <= 3 ? '1-3人' : inviter.referralCount <= 10 ? '4-10人' : '10人以上',
          },
        },
      } as const;
    }, 'partners:referral:calculate-earnings');

    switch (result.type) {
      case 'BOOKING_NOT_FOUND':
        return NextResponse.json({ error: '預約不存在' }, { status: 404 });
      case 'PARTNER_NOT_FOUND':
        return NextResponse.json({ error: '找不到對應的夥伴' }, { status: 404 });
      case 'NO_REFERRAL':
        return NextResponse.json(result.payload);
      case 'INVITER_NOT_FOUND':
        return NextResponse.json({ error: '找不到邀請人' }, { status: 404 });
      case 'ZERO_AMOUNT':
        return NextResponse.json(result.payload);
      case 'ALREADY_CALCULATED':
        return NextResponse.json(result.payload);
      case 'SUCCESS':
        console.log(`✅ 推薦收入計算成功: ${JSON.stringify(result.payload)}`);
        return NextResponse.json(result.payload);
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 });
    }
  } catch (error) {
    return createErrorResponse(error, 'partners:referral:calculate-earnings');
  }
}
