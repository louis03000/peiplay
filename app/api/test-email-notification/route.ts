import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendBookingNotification } from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { testEmail } = body;

    if (!testEmail) {
      return NextResponse.json({ error: '請提供測試 Email' }, { status: 400 });
    }

    // 檢查環境變數
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      return NextResponse.json({ 
        error: 'Email 環境變數未設置',
        details: {
          EMAIL_USER: process.env.EMAIL_USER ? '已設置' : '未設置',
          EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD ? '已設置' : '未設置'
        }
      }, { status: 500 });
    }

    // 發送測試通知
    const result = await sendBookingNotification(
      session.user.id,
      'BOOKING_CREATED',
      {
        bookingId: 'test-booking-123',
        customerName: '測試客戶',
        startTime: new Date().toLocaleString('zh-TW'),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleString('zh-TW'),
        amount: 1000
      }
    );

    if (result) {
      return NextResponse.json({
        success: true,
        message: `測試通知已發送到 ${testEmail}`,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json({
        error: '發送測試通知失敗',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Email 測試失敗:', error);
    return NextResponse.json(
      { 
        error: 'Email 測試失敗: ' + (error instanceof Error ? error.message : '未知錯誤'),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'PeiPlay Email 通知測試 API',
    usage: {
      method: 'POST',
      body: {
        testEmail: 'your-email@gmail.com',
      },
    },
    environment: {
      EMAIL_USER: process.env.EMAIL_USER ? '已設置' : '未設置',
      EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD ? '已設置' : '未設置',
    },
  });
}
