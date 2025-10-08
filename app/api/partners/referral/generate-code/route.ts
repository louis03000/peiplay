import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    if (partner.status !== 'APPROVED') {
      return NextResponse.json({ error: '只有已核准的夥伴才能生成邀請碼' }, { status: 403 });
    }

    // 生成邀請碼（使用夥伴ID的前8位 + 隨機4位數字）
    const partnerIdPrefix = partner.id.substring(0, 8).toUpperCase();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const inviteCode = `${partnerIdPrefix}${randomSuffix}`;

    // 更新夥伴的邀請碼
    const updatedPartner = await prisma.partner.update({
      where: { id: partner.id },
      data: { inviteCode },
      include: { user: true }
    });

    return NextResponse.json({
      inviteCode,
      partner: {
        id: updatedPartner.id,
        name: updatedPartner.name,
        inviteCode: updatedPartner.inviteCode
      }
    });
  } catch (error) {
    console.error('生成邀請碼失敗:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

