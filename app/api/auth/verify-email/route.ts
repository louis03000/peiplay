import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmailVerificationCode } from '@/lib/email';

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

    // 檢查用戶是否存在
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: '用戶不存在' },
        { status: 404 }
      );
    }

    // 如果已經驗證過，不需要重新發送
    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email 已經驗證過了' },
        { status: 400 }
      );
    }

    // 生成 6 位數驗證碼
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 設定過期時間（10分鐘後）
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // 更新用戶的驗證碼和過期時間
    await prisma.user.update({
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
      return NextResponse.json(
        { error: '發送驗證碼失敗，請稍後再試' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '驗證碼已發送到您的 Email',
      expiresIn: 10 * 60, // 10分鐘，單位：秒
    });
  } catch (error) {
    console.error('發送驗證碼失敗:', error);
    return NextResponse.json(
      { error: '發送驗證碼失敗' },
      { status: 500 }
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

    // 查找用戶
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: '用戶不存在' },
        { status: 404 }
      );
    }

    // 檢查是否已經驗證過
    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email 已經驗證過了' },
        { status: 400 }
      );
    }

    // 檢查驗證碼是否存在
    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      return NextResponse.json(
        { error: '請先發送驗證碼' },
        { status: 400 }
      );
    }

    // 檢查驗證碼是否過期
    if (new Date() > user.emailVerificationExpires) {
      return NextResponse.json(
        { error: '驗證碼已過期，請重新發送' },
        { status: 400 }
      );
    }

    // 檢查驗證碼是否正確
    if (user.emailVerificationCode !== code) {
      return NextResponse.json(
        { error: '驗證碼錯誤' },
        { status: 400 }
      );
    }

    // 驗證成功，更新用戶狀態
    await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Email 驗證成功！',
    });
  } catch (error) {
    console.error('驗證 Email 失敗:', error);
    return NextResponse.json(
      { error: '驗證失敗' },
      { status: 500 }
    );
  }
}
