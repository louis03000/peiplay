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

      if (!referralRecord) {
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

      const totalAmount = booking.finalAmount;
      const platformFeePercentage = DEFAULT_REFERRAL_CONFIG.ORIGINAL_PLATFORM_FEE;
      const referralBonusPercentage = calculateTieredReferralRate(inviter.referralCount);

      const platformFee = totalAmount * platformFeePercentage;
      const referralEarning = totalAmount * referralBonusPercentage;
      const actualPlatformFee = platformFee - referralEarning;
      const partnerEarning = totalAmount - platformFee;

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
      case 'SUCCESS':
        return NextResponse.json(result.payload);
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 });
    }
  } catch (error) {
    return createErrorResponse(error, 'partners:referral:calculate-earnings');
  }
}
