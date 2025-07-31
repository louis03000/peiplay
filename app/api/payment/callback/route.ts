import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// 綠界金流設定
const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691',
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6'
}

// 驗證綠界回調的檢查碼
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
  
  queryString += `HashKey=${ECPAY_CONFIG.HASH_KEY}`
  const urlEncoded = encodeURIComponent(queryString)
  const lowerCase = urlEncoded.toLowerCase()
  const withHashIV = lowerCase + `&HashIV=${ECPAY_CONFIG.HASH_IV}`
  const finalEncoded = encodeURIComponent(withHashIV)
  const finalLower = finalEncoded.toLowerCase()
  const hash = crypto.createHash('sha256').update(finalLower).digest('hex')
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
          
          // 更新預約狀態為已完成
          const updateResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/bookings/${booking.id}/update-status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'COMPLETED',
              paymentInfo: {
                orderNumber: MerchantTradeNo,
                paymentDate: PaymentDate,
                paymentType: PaymentType,
                amount: TradeAmt
              }
            })
          })

          if (!updateResponse.ok) {
            console.error('Failed to update booking status to completed')
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