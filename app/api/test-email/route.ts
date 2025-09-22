import { NextRequest, NextResponse } from 'next/server'
import { sendBookingNotificationToPartner, sendChannelCreatedNotificationToCustomer } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 測試 Email 通知功能...')
    
    const { type, email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: '請提供 email 地址' }, { status: 400 })
    }
    
    if (type === 'booking') {
      // 測試預約通知
      const success = await sendBookingNotificationToPartner(
        email,
        '測試夥伴',
        '測試客戶',
        {
          duration: 120,
          startTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          totalCost: 200,
          isInstantBooking: true
        }
      )
      
      if (success) {
        return NextResponse.json({ message: '預約通知測試成功' })
      } else {
        return NextResponse.json({ error: '預約通知測試失敗' }, { status: 500 })
      }
    } else if (type === 'channel') {
      // 測試頻道創建通知
      const success = await sendChannelCreatedNotificationToCustomer(
        email,
        '測試客戶',
        '測試夥伴',
        {
          textChannelId: '123456789',
          voiceChannelId: '987654321',
          startTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }
      )
      
      if (success) {
        return NextResponse.json({ message: '頻道創建通知測試成功' })
      } else {
        return NextResponse.json({ error: '頻道創建通知測試失敗' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: '無效的測試類型' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Email 測試失敗:', error)
    return NextResponse.json({ 
      error: 'Email 測試失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
