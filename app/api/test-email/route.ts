import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendMessageToEmail, sendNotificationToEmail } from '@/lib/email';


export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const body = await request.json();
    const { type, email, testType = 'message' } = body;

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
        session.user.name || '系統管理員',
        {
          subject: '📧 Email 功能測試',
          content: '這是一封測試郵件，用於驗證 PeiPlay 信箱系統的 Email 功能是否正常運作。\n\n如果您收到這封郵件，表示 Email 通知功能已成功設置！',
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
          content: '這是一封測試通知郵件，用於驗證 PeiPlay 系統通知的 Email 功能是否正常運作。',
          createdAt: new Date().toISOString(),
        }
      );
    } else if (testType === 'booking') {
      // 測試預約通知 Email
      result = await sendNotificationToEmail(
        email,
        '測試用戶',
        {
          type: 'BOOKING_CREATED',
          title: '🎮 預約通知測試',
          content: '這是一封測試預約通知郵件，用於驗證預約相關 Email 功能是否正常運作。',
          createdAt: new Date().toISOString(),
          data: {
            bookingId: 'test-booking-id',
            partnerName: '測試夥伴',
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          },
        }
      );
    }

    if (result) {
      return NextResponse.json({
        success: true,
        message: `${testType} 測試郵件已發送到 ${email}`,
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
      { error: 'Email 測試失敗' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email 測試 API',
    usage: {
      method: 'POST',
      body: {
        email: 'test@example.com',
        testType: 'message | notification | booking',
      },
    },
  });
}