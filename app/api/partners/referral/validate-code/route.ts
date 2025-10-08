import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { inviteCode } = await request.json();
    
    if (!inviteCode) {
      return NextResponse.json({ error: '請輸入邀請碼' }, { status: 400 });
    }

    // 查找邀請碼對應的夥伴
    const inviter = await prisma.partner.findFirst({
      where: { 
        inviteCode,
        status: 'APPROVED'
      },
      include: { user: true }
    });

    if (!inviter) {
      return NextResponse.json({ error: '無效的邀請碼' }, { status: 404 });
    }

    // 檢查是否為自己邀請自己
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const currentPartner = await prisma.partner.findUnique({
        where: { userId: session.user.id }
      });
      
      if (currentPartner && currentPartner.id === inviter.id) {
        return NextResponse.json({ error: '不能使用自己的邀請碼' }, { status: 400 });
      }
    }

    return NextResponse.json({
      valid: true,
      inviter: {
        id: inviter.id,
        name: inviter.name,
        inviteCode: inviter.inviteCode
      }
    });
  } catch (error) {
    console.error('驗證邀請碼失敗:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

