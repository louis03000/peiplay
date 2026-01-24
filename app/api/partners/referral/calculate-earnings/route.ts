import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';
import { BookingStatus } from '@prisma/client';

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
  // 📈 推薦 1-3 人：獲得 2% 推薦獎勵
  // 📈 推薦 4-10 人：獲得 3% 推薦獎勵
  // 📈 推薦 10 人以上：獲得 4% 推薦獎勵
  if (referralCount >= 1 && referralCount <= 3) {
    return DEFAULT_REFERRAL_CONFIG.TIERED_REFERRAL_RATES[1]; // 2%
  } else if (referralCount >= 4 && referralCount <= 10) {
    return DEFAULT_REFERRAL_CONFIG.TIERED_REFERRAL_RATES[3]; // 3%
  } else if (referralCount > 10) {
    return DEFAULT_REFERRAL_CONFIG.TIERED_REFERRAL_RATES[10]; // 4%
  } else {
    // 如果 referralCount 為 0 或負數，返回 0
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();

    if (!bookingId) {
      return NextResponse.json({ error: '缺少預約ID' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      let booking = await client.booking.findUnique({
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

      // 🔥 檢查訂單是否已結束
      const now = new Date();
      const scheduleEndTime = booking.schedule?.endTime;
      const isEnded = scheduleEndTime && scheduleEndTime <= now;
      
      // 🔥 確保只有已結束的訂單才計算推薦收入
      if (!isEnded) {
        console.log(`⚠️ 訂單 ${bookingId} 尚未結束（結束時間：${scheduleEndTime?.toISOString()}），跳過推薦收入計算`);
        return {
          type: 'NOT_ENDED',
          payload: {
            message: '訂單尚未結束，無法計算推薦收入',
            endTime: scheduleEndTime,
          },
        } as const;
      }
      
      // 🔥 如果訂單已結束但狀態不是 COMPLETED，先更新狀態為 COMPLETED
      // 這樣可以確保所有已結束的訂單都能被計算推薦收入
      if (booking.status !== BookingStatus.COMPLETED) {
        console.log(`🔧 訂單 ${bookingId} 已結束但狀態為 ${booking.status}，更新為 COMPLETED`);
        await client.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.COMPLETED }
        });
        console.log(`✅ 訂單 ${bookingId} 狀態已更新為 COMPLETED`);
        // 重新查詢訂單以獲取最新狀態
        const updatedBooking = await client.booking.findUnique({
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
        if (updatedBooking) {
          booking = updatedBooking;
        }
      }

      const partner = booking.schedule.partner;
      const referralRecord = partner.referralsReceived;

      // 🔥 添加详细调试日志
      console.log(`🔍 [推薦收入計算] 預約 ${bookingId}:`, {
        bookingStatus: booking.status,
        bookingAmount: booking.finalAmount,
        partnerId: partner.id,
        partnerName: partner.name,
        hasReferralRecord: !!referralRecord,
        referralRecordId: referralRecord?.id,
        inviterId: referralRecord?.inviterId,
        inviteeId: referralRecord?.inviteeId,
      });
      
      if (!referralRecord) {
        console.log(`   ⚠️ 夥伴 ${partner.id} (${partner.name}) 沒有推薦記錄，可能不是被推薦的夥伴`);
      } else {
        console.log(`   ✅ 找到推薦記錄: 推薦人 ${referralRecord.inviterId}, 被推薦人 ${referralRecord.inviteeId}`);
      }

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

      // 🔥 被推薦夥伴基礎收益是85%（100% - 15%平台抽成）
      // 但排名優惠仍然要加上去（第一名+2%，第二三名+1%）
      // 推薦獎勵從平台維護費中扣除
      const platformFeePercentage = DEFAULT_REFERRAL_CONFIG.ORIGINAL_PLATFORM_FEE; // 15%
      const referralBonusPercentage = calculateTieredReferralRate(inviter.referralCount); // 2%, 3%, 或 4%
      
      // 獲取被推薦夥伴的排名優惠
      let inviteeRankDiscount = 0;
      try {
        const { getPartnerLastWeekRank, getPlatformFeeDiscount } = await import('@/lib/ranking-helpers');
        const inviteeRank = await getPartnerLastWeekRank(partner.id);
        inviteeRankDiscount = getPlatformFeeDiscount(inviteeRank);
      } catch (error) {
        console.warn(`⚠️ 獲取被推薦夥伴排名失敗:`, error);
        inviteeRankDiscount = 0;
      }
      
      // 被推薦夥伴實際獲得 = 85% + 排名優惠
      // 例如：第一名 = 85% + 2% = 87%
      // 例如：第二名 = 85% + 1% = 86%
      const inviteeActualFee = platformFeePercentage - inviteeRankDiscount; // 平台對被推薦夥伴的實際抽成
      const partnerEarning = totalAmount * (1 - inviteeActualFee);
      
      // 平台實際抽成 = 15% - 推薦獎勵比例 - 排名優惠（從平台維護費中扣除）
      const actualPlatformFee = platformFeePercentage - referralBonusPercentage - inviteeRankDiscount;
      
      // 推薦獎勵 = 總金額 × 推薦獎勵比例（從平台維護費中扣除）
      const referralEarning = totalAmount * referralBonusPercentage;
      
      // 平台實際收入 = 總金額 × 實際平台抽成
      const platformActualIncome = totalAmount * actualPlatformFee;

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
            tier: inviter.referralCount >= 1 && inviter.referralCount <= 3 ? '1-3人' : 
                  inviter.referralCount >= 4 && inviter.referralCount <= 10 ? '4-10人' : 
                  inviter.referralCount > 10 ? '10人以上' : '0人',
          },
        },
      } as const;
    }, 'partners:referral:calculate-earnings');

    switch (result.type) {
      case 'BOOKING_NOT_FOUND':
        return NextResponse.json({ error: '預約不存在' }, { status: 404 });
      case 'PARTNER_NOT_FOUND':
        return NextResponse.json({ error: '找不到對應的夥伴' }, { status: 404 });
      case 'NOT_ENDED':
        return NextResponse.json(result.payload);
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
