import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendNotification, NotificationType } from '@/lib/notifications'

// 綠界金流設定
const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691',
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6'
}

// 自定義 URLEncode 函數，使用舊版標準（空格編碼為 +）
function customUrlEncode(str: string): string {
  return str.replace(/\+/g, '%2B')
            .replace(/\s/g, '+')
            .replace(/"/g, '%22')
            .replace(/'/g, '%27')
            .replace(/</g, '%3C')
            .replace(/>/g, '%3E')
            .replace(/#/g, '%23')
            .replace(/%/g, '%25')
            .replace(/\{/g, '%7B')
            .replace(/\}/g, '%7D')
            .replace(/\|/g, '%7C')
            .replace(/\\/g, '%5C')
            .replace(/\^/g, '%5E')
            .replace(/\[/g, '%5B')
            .replace(/\]/g, '%5D')
            .replace(/`/g, '%60')
            .replace(/;/g, '%3B')
            .replace(/\//g, '%2F')
            .replace(/\?/g, '%3F')
            .replace(/:/g, '%3A')
            .replace(/@/g, '%40')
            .replace(/=/g, '%3D')
            .replace(/&/g, '%26')
            .replace(/\$/g, '%24')
            .replace(/,/g, '%2C')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/!/g, '%21')
            .replace(/~/g, '%7E')
            .replace(/\*/g, '%2A')
            // 移除對 . 和 - 的編碼，讓它們保持原樣
            // .replace(/\./g, '%2E')
            // .replace(/_/g, '%5F')
            // .replace(/-/g, '%2D')
}

// 綠界官方正確的 CheckMacValue 驗證方式
function verifyCheckMacValue(params: Record<string, string>): boolean {
  const receivedCheckMacValue = params.CheckMacValue
  delete params.CheckMacValue

  // 重新產生檢查碼
  const sortedKeys = Object.keys(params).sort()
  let queryString = ''
  
  for (const key of sortedKeys) {
    if (params[key] !== '' && params[key] !== null && params[key] !== undefined) {
      queryString += `${key}=${params[key]}&`
    }
  }
  
  // 移除最後一個 & 符號
  queryString = queryString.slice(0, -1)
  
  // 最前面加上 HashKey，最後面加上 HashIV（綠界官方正確方式）
  const withKeys = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${queryString}&HashIV=${ECPAY_CONFIG.HASH_IV}`
  
  // 進行 URL encode（使用舊版標準，空格編碼為 +）
  const urlEncoded = customUrlEncode(withKeys)
  
  // 轉為小寫
  const lowerCase = urlEncoded.toLowerCase()
  
  // 使用 SHA256 加密
  const hash = crypto.createHash('sha256').update(lowerCase).digest('hex')
  const calculatedCheckMacValue = hash.toUpperCase()

  return calculatedCheckMacValue === receivedCheckMacValue
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}

    // 將 FormData 轉換為物件
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        params[key] = value
      }
    }

    console.log('Payment callback received:', params)

    // 驗證檢查碼
    if (!verifyCheckMacValue(params)) {
      console.error('CheckMacValue verification failed')
      return NextResponse.json({ error: '驗證失敗' }, { status: 400 })
    }

    const {
      MerchantTradeNo,
      PaymentDate,
      PaymentType,
      PaymentTypeChargeFee,
      SimulatePaid,
      RtnCode,
      RtnMsg,
      TradeAmt,
      TradeDate,
      TradeDesc
    } = params

    // 檢查付款結果
    const isSuccess = RtnCode === '1' || SimulatePaid === 'Y'
    
    if (isSuccess) {
      // 付款成功，更新預約狀態
      try {
        // 根據訂單編號找到對應的預約
        const bookingResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/bookings/find-by-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderNumber: MerchantTradeNo
          })
        })

        if (bookingResponse.ok) {
          const booking = await bookingResponse.json()
          
          // 驗證付款金額是否正確
          const actualAmount = parseInt(TradeAmt)
          const expectedAmount = booking.finalAmount || 0
          
          let paymentStatus = 'PAID_WAITING_PARTNER_CONFIRMATION'  // 付款成功，等待夥伴確認
          let paymentNote = ''
          
          if (expectedAmount > 0 && actualAmount !== expectedAmount) {
            // 金額不匹配，記錄差異
            paymentStatus = 'COMPLETED_WITH_AMOUNT_MISMATCH'
            paymentNote = `預期金額: ${expectedAmount}元, 實際付款: ${actualAmount}元, 差異: ${actualAmount - expectedAmount}元`
            console.warn(`Payment amount mismatch for booking ${booking.id}: expected ${expectedAmount}, actual ${actualAmount}`)
          }
          
          // 更新預約狀態
          const updateResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/bookings/${booking.id}/update-status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: paymentStatus,
              paymentInfo: {
                orderNumber: MerchantTradeNo,
                paymentDate: PaymentDate,
                paymentType: PaymentType,
                amount: TradeAmt,
                expectedAmount: expectedAmount,
                amountMismatch: actualAmount !== expectedAmount,
                paymentNote: paymentNote
              }
            })
          })

                     if (!updateResponse.ok) {
             console.error('Failed to update booking status to completed')
           } else {
             // 發送付款成功通知
             try {
               const notificationData = {
                 type: 'PAYMENT_SUCCESS' as NotificationType,
                 bookingId: booking.id,
                 customerEmail: booking.customer?.user?.email || '',
                 customerName: booking.customer?.name || '',
                 partnerEmail: booking.schedule?.partner?.user?.email || '',
                 partnerName: booking.schedule?.partner?.name || '',
                 scheduleDate: new Date(booking.schedule?.date || ''),
                 startTime: new Date(booking.schedule?.startTime || ''),
                 endTime: new Date(booking.schedule?.endTime || ''),
                 amount: actualAmount,
                 orderNumber: MerchantTradeNo,
               };
               
               const notificationResult = await sendNotification(notificationData);
               console.log('📧 通知發送結果:', notificationResult);
             } catch (notificationError) {
               console.error('❌ 發送通知失敗:', notificationError);
             }
           }
        }
      } catch (error) {
        console.error('Error updating booking status:', error)
      }

      // 回傳成功給綠界
      return NextResponse.json({
        RtnCode: '1',
        RtnMsg: 'OK'
      })
    } else {
      // 付款失敗，更新預約狀態
      try {
        const bookingResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/bookings/find-by-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderNumber: MerchantTradeNo
          })
        })

        if (bookingResponse.ok) {
          const booking = await bookingResponse.json()
          
          // 更新預約狀態為已確認（讓用戶可以重新付款）
          const updateResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/bookings/${booking.id}/update-status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'CONFIRMED',
              paymentError: RtnMsg
            })
          })

                     if (!updateResponse.ok) {
             console.error('Failed to update booking status to confirmed')
           } else {
             // 發送付款失敗通知
             try {
               const notificationData = {
                 type: 'PAYMENT_FAILED' as NotificationType,
                 bookingId: booking.id,
                 customerEmail: booking.customer?.user?.email || '',
                 customerName: booking.customer?.name || '',
                 partnerEmail: booking.schedule?.partner?.user?.email || '',
                 partnerName: booking.schedule?.partner?.name || '',
                 scheduleDate: new Date(booking.schedule?.date || ''),
                 startTime: new Date(booking.schedule?.startTime || ''),
                 endTime: new Date(booking.schedule?.endTime || ''),
                 amount: booking.finalAmount || 0,
                 orderNumber: MerchantTradeNo,
               };
               
               const notificationResult = await sendNotification(notificationData);
               console.log('📧 付款失敗通知發送結果:', notificationResult);
             } catch (notificationError) {
               console.error('❌ 發送付款失敗通知失敗:', notificationError);
             }
           }
        }
      } catch (error) {
        console.error('Error updating booking status:', error)
      }

      // 回傳失敗給綠界
      return NextResponse.json({
        RtnCode: '0',
        RtnMsg: 'Payment failed'
      })
    }

  } catch (error) {
    console.error('Payment callback error:', error)
    return NextResponse.json({ error: '處理付款回調失敗' }, { status: 500 })
  }
} 