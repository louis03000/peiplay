import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      include: { user: true }
    });

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 });
    }

    // 獲取推薦統計
    const [referralStats, recentReferrals, referralEarnings] = await Promise.all([
      // 推薦統計
      prisma.referralRecord.findMany({
        where: { inviterId: partner.id },
        include: {
          invitee: {
            include: { user: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      // 最近的推薦收入
      prisma.referralEarning.findMany({
        where: {
          referralRecord: {
            inviterId: partner.id
          }
        },
        include: {
          booking: {
            include: {
              schedule: {
                include: {
                  partner: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      // 總推薦收入
      prisma.referralEarning.aggregate({
        where: {
          referralRecord: {
            inviterId: partner.id
          }
        },
        _sum: {
          amount: true
        }
      })
    ]);

    // 計算統計數據
    const totalReferrals = referralStats.length;
    const totalEarnings = referralEarnings._sum.amount || 0;
    const currentEarnings = partner.referralEarnings || 0;

    // 格式化推薦列表
    const referrals = referralStats.map(record => ({
      id: record.id,
      inviteeName: record.invitee.name,
      inviteeEmail: record.invitee.user.email,
      createdAt: record.createdAt,
      inviteCode: record.inviteCode
    }));

    // 格式化收入記錄
    const earnings = referralEarnings.map(earning => ({
      id: earning.id,
      amount: earning.amount,
      percentage: earning.percentage,
      createdAt: earning.createdAt,
      bookingId: earning.bookingId,
      inviteeName: earning.booking.schedule?.partner?.name || '未知'
    }));

    return NextResponse.json({
      partner: {
        id: partner.id,
        name: partner.name,
        inviteCode: partner.inviteCode,
        referralCount: partner.referralCount,
        referralEarnings: currentEarnings,
        totalReferralEarnings: partner.totalReferralEarnings
      },
      stats: {
        totalReferrals,
        totalEarnings,
        currentEarnings
      },
      referrals,
      earnings
    });
  } catch (error) {
    console.error('獲取推薦統計失敗:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

