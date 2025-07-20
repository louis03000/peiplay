import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const { confirmationCode } = await request.json();
    
    // 驗證確認碼
    const expectedCode = 'delect_account';
    
    if ((confirmationCode || '').trim() !== expectedCode) {
      return NextResponse.json({ error: '確認碼錯誤' }, { status: 400 });
    }

    const userEmail = session.user.email;

    // 簡化的刪除邏輯 - 只刪除用戶資料
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    // 直接刪除用戶（會自動處理關聯資料）
    await prisma.user.delete({
      where: { id: user.id }
    });

    return NextResponse.json({ 
      success: true, 
      message: '帳號已成功註銷' 
    });

  } catch (error) {
    console.error('簡化刪除帳號時發生錯誤:', error);
    return NextResponse.json({ 
      error: '註銷帳號時發生錯誤，請稍後再試',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 