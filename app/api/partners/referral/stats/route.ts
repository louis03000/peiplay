import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          name: true,
          inviteCode: true,
          referralCount: true,
          referralEarnings: true,
          totalReferralEarnings: true,
        },
      })

      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      const [referralStats, recentReferrals, referralEarnings] = await Promise.all([
        client.referralRecord.findMany({
          where: { inviterId: partner.id },
          include: {
            invitee: {
              include: {
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        client.referralEarning.findMany({
          where: { referralRecord: { inviterId: partner.id } },
          include: {
            referralRecord: {
              include: {
                invitee: true,
              },
            },
            booking: {
              include: {
                schedule: {
                  include: {
                    partner: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        client.referralEarning.aggregate({
          where: { referralRecord: { inviterId: partner.id } },
          _sum: { amount: true },
        }),
      ])

      const totalReferrals = referralStats.length
      const totalEarnings = referralEarnings._sum.amount || 0
      let currentEarnings = partner.referralEarnings || 0
      
      // 🔥 检查数据一致性：如果 totalEarnings 和 currentEarnings 不一致，修复数据
      // 使用 totalEarnings 作为真实值，因为它来自 ReferralEarning 表的聚合
      if (Math.abs(totalEarnings - currentEarnings) > 0.01) {
        console.warn(`⚠️ [推薦統計] 數據不一致: 夥伴 ${partner.id} (${partner.name})`, {
          totalEarningsFromDB: totalEarnings,
          currentEarningsFromPartner: currentEarnings,
          difference: totalEarnings - currentEarnings,
        });
        
        // 🔥 修复数据：如果 totalEarnings > currentEarnings，说明有推荐收入没有被正确更新到 Partner 表
        // 更新 Partner 表的 referralEarnings 字段
        if (totalEarnings > currentEarnings) {
          console.log(`🔧 [推薦統計] 修復數據不一致: 更新 Partner.referralEarnings 從 ${currentEarnings} 到 ${totalEarnings}`);
          await client.partner.update({
            where: { id: partner.id },
            data: {
              referralEarnings: totalEarnings,
            },
          });
          currentEarnings = totalEarnings;
        }
      }
      
      // 🔥 添加诊断信息：检查被邀请人的订单状态
      const inviteeIds = referralStats.map(r => r.inviteeId);
      const inviteeBookings = inviteeIds.length > 0 ? await client.booking.findMany({
        where: {
          schedule: {
            partnerId: { in: inviteeIds },
          },
          status: { in: ['COMPLETED', 'CONFIRMED', 'PARTNER_ACCEPTED'] },
          finalAmount: { gt: 0 },
        },
        include: {
          schedule: {
            select: {
              endTime: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      }) : [];
      
      const now = new Date();
      const endedBookings = inviteeBookings.filter(b => b.schedule?.endTime && b.schedule.endTime <= now);
      const completedBookings = inviteeBookings.filter(b => b.status === 'COMPLETED');
      
      // 🔥 自动处理已结束但状态不是 COMPLETED 的订单，并计算推荐收入
      const bookingsToProcess = endedBookings.filter(b => b.status !== 'COMPLETED');
      if (bookingsToProcess.length > 0) {
        console.log(`🔧 [推薦統計] 發現 ${bookingsToProcess.length} 個已結束但狀態不是 COMPLETED 的訂單，開始處理...`);
        
        for (const booking of bookingsToProcess) {
          try {
            // 更新訂單狀態為 COMPLETED
            await client.booking.update({
              where: { id: booking.id },
              data: { status: 'COMPLETED' }
            });
            
            // 觸發推薦收入計算（非阻塞）
            const baseUrl = process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app';
            fetch(`${baseUrl}/api/partners/referral/calculate-earnings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingId: booking.id }),
            }).catch(err => {
              console.warn(`⚠️ 訂單 ${booking.id} 推薦收入計算觸發失敗:`, err);
            });
            
            console.log(`✅ 訂單 ${booking.id} 狀態已更新為 COMPLETED，已觸發推薦收入計算`);
          } catch (error) {
            console.error(`❌ 處理訂單 ${booking.id} 時發生錯誤:`, error);
          }
        }
        
        // 重新查詢推薦收入統計（等待一小段時間讓計算完成）
        await new Promise(resolve => setTimeout(resolve, 1000));
        const updatedEarnings = await client.referralEarning.aggregate({
          where: { referralRecord: { inviterId: partner.id } },
          _sum: { amount: true },
        });
        totalEarnings = updatedEarnings._sum.amount || 0;
        currentEarnings = partner.referralEarnings || 0;
        
        // 如果數據不一致，修復
        if (Math.abs(totalEarnings - currentEarnings) > 0.01 && totalEarnings > currentEarnings) {
          await client.partner.update({
            where: { id: partner.id },
            data: { referralEarnings: totalEarnings },
          });
          currentEarnings = totalEarnings;
        }
      }
      
      // 🔥 添加调试日志：检查推荐收入和统计
      console.log(`[推薦統計] 夥伴 ${partner.id} (${partner.name}):`, {
        referralCount: partner.referralCount,
        referralEarnings: partner.referralEarnings,
        totalReferralEarnings: partner.totalReferralEarnings,
        totalEarningsFromDB: totalEarnings,
        currentEarningsAfterFix: currentEarnings,
        totalReferrals: totalReferrals,
        referralRecordsCount: referralStats.length,
        referralEarningsCount: recentReferrals.length,
        inviteeBookingsCount: inviteeBookings.length,
        endedBookingsCount: endedBookings.length,
        completedBookingsCount: completedBookings.length,
        processedBookingsCount: bookingsToProcess.length,
        inviteeIds: inviteeIds,
      });

      const referrals = referralStats.map((record) => ({
        id: record.id,
        inviteeName: record.invitee.name,
        inviteeEmail: record.invitee.user.email,
        createdAt: record.createdAt,
        inviteCode: record.inviteCode,
      }))

      const earnings = recentReferrals.map((earning) => ({
        id: earning.id,
        amount: earning.amount,
        percentage: earning.percentage,
        createdAt: earning.createdAt,
        bookingId: earning.bookingId,
        inviteeName: earning.referralRecord?.invitee?.name || '未知',
      }))

      return {
        type: 'SUCCESS',
        payload: {
          partner: {
            id: partner.id,
            name: partner.name,
            inviteCode: partner.inviteCode,
            referralCount: partner.referralCount,
            referralEarnings: currentEarnings,
            totalReferralEarnings: partner.totalReferralEarnings,
          },
          stats: {
            totalReferrals,
            totalEarnings: totalEarnings, // 從 ReferralEarning 表聚合的總收入
            currentEarnings: currentEarnings, // 從 Partner.referralEarnings 字段獲取的可提領收入（已修復）
          },
          referrals,
          earnings,
        },
      } as const
    }, 'partners:referral:stats')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    return NextResponse.json(result.payload)
  } catch (error) {
    return createErrorResponse(error, 'partners:referral:stats')
  }
}

