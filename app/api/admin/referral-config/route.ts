import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');

    if (partnerId) {
      // 獲取特定夥伴的推薦配置
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          name: true,
          referralPlatformFee: true,
          referralBonusPercentage: true,
          referralCount: true,
          totalReferralEarnings: true
        }
      });

      if (!partner) {
        return NextResponse.json({ error: '夥伴不存在' }, { status: 404 });
      }

      return NextResponse.json(partner);
    } else {
      // 獲取所有夥伴的推薦配置
      const partners = await prisma.partner.findMany({
        where: { status: 'APPROVED' },
        select: {
          id: true,
          name: true,
          referralPlatformFee: true,
          referralBonusPercentage: true,
          referralCount: true,
          totalReferralEarnings: true
        },
        orderBy: { name: 'asc' }
      });

      return NextResponse.json(partners);
    }
  } catch (error) {
    console.error('獲取推薦配置失敗:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { partnerId, referralPlatformFee, referralBonusPercentage } = await request.json();

    if (!partnerId || referralPlatformFee === undefined || referralBonusPercentage === undefined) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 驗證數值範圍
    if (referralPlatformFee < 0 || referralPlatformFee > 100) {
      return NextResponse.json({ error: '平台抽成比例必須在 0-100% 之間' }, { status: 400 });
    }

    if (referralBonusPercentage < 0 || referralBonusPercentage > 100) {
      return NextResponse.json({ error: '推薦獎勵比例必須在 0-100% 之間' }, { status: 400 });
    }

    if (referralPlatformFee + referralBonusPercentage > 100) {
      return NextResponse.json({ error: '平台抽成 + 推薦獎勵不能超過 100%' }, { status: 400 });
    }

    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        referralPlatformFee,
        referralBonusPercentage
      },
      select: {
        id: true,
        name: true,
        referralPlatformFee: true,
        referralBonusPercentage: true
      }
    });

    return NextResponse.json(updatedPartner);
  } catch (error) {
    console.error('更新推薦配置失敗:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

