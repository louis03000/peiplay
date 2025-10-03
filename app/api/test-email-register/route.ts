import { NextRequest, NextResponse } from 'next/server';
import { sendEmailVerificationCode } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: '請提供測試 Email 地址' },
        { status: 400 }
      );
    }

    // 測試發送驗證碼
    const testCode = '123456';
    const emailSent = await sendEmailVerificationCode(
      email,
      '測試用戶',
      testCode
    );

    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: `測試驗證碼已發送到 ${email}`,
        code: testCode,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        { error: '發送測試驗證碼失敗' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Email 測試失敗:', error);
    return NextResponse.json(
      { error: 'Email 測試失敗: ' + (error instanceof Error ? error.message : '未知錯誤') },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'PeiPlay Email 註冊測試 API',
    usage: {
      method: 'POST',
      body: {
        email: 'your-email@gmail.com',
      },
    },
    example: {
      message: 'curl -X POST https://peiplay.vercel.app/api/test-email-register -H "Content-Type: application/json" -d \'{"email": "your-email@gmail.com"}\'',
    },
  });
}
