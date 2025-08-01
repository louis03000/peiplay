import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// 綠界金流設定
const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691',
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6',
  PAYMENT_URL: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
  RETURN_URL: 'https://peiplay.vercel.app/api/payment/callback',
  CLIENT_BACK_URL: 'https://peiplay.vercel.app/booking',
  CLIENT_FRONT_URL: 'https://peiplay.vercel.app/booking'
}

// 產生綠界金流所需的檢查碼
function generateCheckMacValue(params: Record<string, string>): string {
  // 1. 將參數依照參數名稱 ASCII Code 編碼排序
  const sortedKeys = Object.keys(params).sort()
  
  // 2. 組合參數
  let queryString = ''
  for (const key of sortedKeys) {
    if (params[key] !== '' && params[key] !== null && params[key] !== undefined) {
      queryString += `${key}=${params[key]}&`
    }
  }
  
  // 3. 加入 HashKey
  queryString += `HashKey=${ECPAY_CONFIG.HASH_KEY}`
  
  // 4. 進行 URL encode
  const urlEncoded = encodeURIComponent(queryString)
  
  // 5. 轉為小寫
  const lowerCase = urlEncoded.toLowerCase()
  
  // 6. 加入 HashIV
  const withHashIV = lowerCase + `&HashIV=${ECPAY_CONFIG.HASH_IV}`
  
  // 7. 進行 URL encode
  const finalEncoded = encodeURIComponent(withHashIV)
  
  // 8. 轉為小寫
  const finalLower = finalEncoded.toLowerCase()
  
  // 9. 使用 SHA256 加密
  const hash = crypto.createHash('sha256').update(finalLower).digest('hex')
  
  // 10. 轉為大寫
  return hash.toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bookingId, amount, description, customerName, customerEmail } = body

    if (!bookingId || !amount || !description) {
      return NextResponse.json(
        { error: '缺少必要參數' },
        { status: 400 }
      )
    }

    // 產生訂單編號（格式：年月日時分秒 + 4位隨機數）
    const now = new Date()
    const orderNumber = `PEI${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`

    // 準備綠界金流參數
    const ecpayParams: Record<string, string> = {
      MerchantID: ECPAY_CONFIG.MERCHANT_ID,
      MerchantTradeNo: orderNumber,
      MerchantTradeDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      PaymentType: 'aio',
      TotalAmount: amount.toString(),
      TradeDesc: description,
      ItemName: `PeiPlay 遊戲夥伴預約 - ${description}`,
      ReturnURL: ECPAY_CONFIG.RETURN_URL,
      ClientBackURL: ECPAY_CONFIG.CLIENT_BACK_URL,
      OrderResultURL: ECPAY_CONFIG.CLIENT_FRONT_URL,
      ChoosePayment: 'Credit',
      EncryptType: '1'
    }

    // 產生檢查碼
    const checkMacValue = generateCheckMacValue(ecpayParams)
    ecpayParams.CheckMacValue = checkMacValue

    // 更新預約狀態為等待付款
    try {
      const updateResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/bookings/${bookingId}/update-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'PENDING_PAYMENT',
          orderNumber: orderNumber
        })
      })

      if (!updateResponse.ok) {
        console.error('Failed to update booking status')
      }
    } catch (error) {
      console.error('Error updating booking status:', error)
    }

    return NextResponse.json({
      success: true,
      paymentUrl: ECPAY_CONFIG.PAYMENT_URL,
      params: ecpayParams,
      orderNumber: orderNumber
    })

  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json(
      { error: '建立付款失敗' },
      { status: 500 }
    )
  }
} 