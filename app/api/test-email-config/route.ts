import { NextResponse } from 'next/server';
import { sendBookingNotificationToPartner } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 檢查環境變數
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_APP_PASSWORD;
    
    if (!emailUser || !emailPass) {
      return NextResponse.json({
        success: false,
        error: 'Email 環境變數未配置',
        details: {
          EMAIL_USER: emailUser ? '已配置' : '未配置',
          EMAIL_APP_PASSWORD: emailPass ? '已配置' : '未配置'
        }
      }, { status: 400 });
    }

    // 測試發送 Email
    const testResult = await sendBookingNotificationToPartner(
      'louis92427@gmail.com', // 您的 Gmail
      '測試夥伴',
      '測試客戶',
      {
        duration: 30,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        totalCost: 100,
        isInstantBooking: false
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Email 配置測試成功',
      emailSent: testResult,
      config: {
        EMAIL_USER: emailUser,
        EMAIL_APP_PASSWORD: emailPass ? '已配置' : '未配置'
      }
    });
  } catch (error) {
    console.error('Email 配置測試失敗:', error);
    return NextResponse.json({
      success: false,
      error: 'Email 配置測試失敗',
      details: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
}
