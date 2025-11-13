import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';
import { sendEmailVerificationCode } from '@/lib/email';

export const dynamic = 'force-dynamic';

// 發送 Email 驗證碼
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: '請提供 Email 地址' },
        { status: 400 }
      );
    }

    const result = await db.query(async (client) => {
      // 檢查用戶是否存在
      const user = await client.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error('用戶不存在');
      }

      // 如果已經驗證過，不需要重新發送
      if (user.emailVerified) {
        throw new Error('Email 已經驗證過了');
      }

      // 生成 6 位數驗證碼
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 設定過期時間（10分鐘後）
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // 更新用戶的驗證碼和過期時間
      await client.user.update({
        where: { email },
        data: {
          emailVerificationCode: verificationCode,
          emailVerificationExpires: expiresAt,
        },
      });

      // 發送驗證碼 Email
      const emailSent = await sendEmailVerificationCode(
        email,
        user.name || '用戶',
        verificationCode
      );

      if (!emailSent) {
        throw new Error('發送驗證碼失敗，請稍後再試');
      }

      return {
        success: true,
        message: '驗證碼已發送到您的 Email',
        expiresIn: 10 * 60, // 10分鐘，單位：秒
      };
    }, 'auth/verify-email:POST');

    return NextResponse.json(result);
  } catch (error) {
    console.error('發送驗證碼失敗:', error);
    if (error instanceof NextResponse) {
      return error;
    }
    const errorMessage = error instanceof Error ? error.message : '發送驗證碼失敗';
    const status = errorMessage.includes('不存在') ? 404 :
                   errorMessage.includes('已經驗證') || errorMessage.includes('發送驗證碼失敗') ? 400 : 500;
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}

// 驗證 Email 驗證碼
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: '請提供 Email 和驗證碼' },
        { status: 400 }
      );
    }

    const result = await db.query(async (client) => {
      // 查找用戶
      const user = await client.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error('用戶不存在');
      }

      // 檢查是否已經驗證過
      if (user.emailVerified) {
        throw new Error('Email 已經驗證過了');
      }

      // 檢查驗證碼是否存在
      if (!user.emailVerificationCode || !user.emailVerificationExpires) {
        throw new Error('請先發送驗證碼');
      }

      // 檢查驗證碼是否過期
      if (new Date() > user.emailVerificationExpires) {
        throw new Error('驗證碼已過期，請重新發送');
      }

      // 檢查驗證碼是否正確
      if (user.emailVerificationCode !== code) {
        throw new Error('驗證碼錯誤');
      }

      // 驗證成功，更新用戶狀態
      await client.user.update({
        where: { email },
        data: {
          emailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpires: null,
        },
      });

      return {
        success: true,
        message: 'Email 驗證成功！',
      };
    }, 'auth/verify-email:PUT');

    return NextResponse.json(result);
  } catch (error) {
    console.error('驗證 Email 失敗:', error);
    if (error instanceof NextResponse) {
      return error;
    }
    const errorMessage = error instanceof Error ? error.message : '驗證失敗';
    const status = errorMessage.includes('不存在') ? 404 :
                   errorMessage.includes('已經驗證') || errorMessage.includes('請先發送') || 
                   errorMessage.includes('已過期') || errorMessage.includes('錯誤') ? 400 : 500;
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}
