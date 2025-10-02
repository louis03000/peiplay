import { NextRequest, NextResponse } from 'next/server';
import { sendMessageToEmail, sendNotificationToEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, testType = 'message' } = body;

    if (!email) {
      return NextResponse.json(
        { error: '請提供測試 Email 地址' },
        { status: 400 }
      );
    }

    let result = false;

    if (testType === 'message') {
      // 測試訊息 Email
      result = await sendMessageToEmail(
        email,
        '測試用戶',
        'PeiPlay 系統',
        {
          subject: '📧 Email 功能測試',
          content: '這是一封測試郵件，用於驗證 PeiPlay 信箱系統的 Email 功能是否正常運作。\n\n如果您收到這封郵件，表示 Email 通知功能已成功設置！\n\n測試時間：' + new Date().toLocaleString('zh-TW'),
          type: 'SYSTEM',
          createdAt: new Date().toISOString(),
        }
      );
    } else if (testType === 'notification') {
      // 測試通知 Email
      result = await sendNotificationToEmail(
        email,
        '測試用戶',
        {
          type: 'SYSTEM_ANNOUNCEMENT',
          title: '🔔 Email 通知測試',
          content: '這是一封測試通知郵件，用於驗證 PeiPlay 系統通知的 Email 功能是否正常運作。\n\n測試時間：' + new Date().toLocaleString('zh-TW'),
          createdAt: new Date().toISOString(),
        }
      );
    }

    if (result) {
      return NextResponse.json({
        success: true,
        message: `${testType} 測試郵件已發送到 ${email}`,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        { error: '發送測試郵件失敗' },
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
    message: 'PeiPlay Email 測試 API',
    usage: {
      method: 'POST',
      body: {
        email: 'your-email@gmail.com',
        testType: 'message | notification',
      },
    },
    example: {
      message: 'curl -X POST https://peiplay.vercel.app/api/test-email-public -H "Content-Type: application/json" -d \'{"email": "your-email@gmail.com", "testType": "message"}\'',
    },
  });
}
