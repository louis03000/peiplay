import { NextResponse } from 'next/server';
import { sendNotification, NotificationType } from '@/lib/notifications';


export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type = 'BOOKING_CREATED' } = body;

    // 測試資料
    const testData = {
      type: type as NotificationType,
      bookingId: 'test-123',
      customerEmail: 'test@example.com',
      customerName: '測試顧客',
      partnerEmail: 'partner@example.com',
      partnerName: '測試夥伴',
      scheduleDate: new Date(),
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000), // 1小時後
      amount: 300,
      orderNumber: 'TEST123456',
    };

    console.log('🧪 測試通知資料:', testData);

    // 發送通知
    const result = await sendNotification(testData);
    
    console.log('📧 測試通知結果:', result);

    return NextResponse.json({
      success: true,
      message: '測試通知已發送',
      testData,
      result,
    });

  } catch (error) {
    console.error('❌ 測試通知失敗:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '測試通知失敗',
        details: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: '通知測試端點',
    usage: 'POST /api/test/notification',
    body: {
      type: 'BOOKING_CREATED | PAYMENT_SUCCESS | PAYMENT_FAILED | etc.'
    }
  });
}
