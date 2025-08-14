import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// 綠界金流設定
const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691', // 正式環境的商店ID
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6',
  PAYMENT_URL: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5', // 使用正式環境
  RETURN_URL: 'https://peiplay.vercel.app/api/payment/callback',
  CLIENT_BACK_URL: 'https://peiplay.vercel.app/booking',
  CLIENT_FRONT_URL: 'https://peiplay.vercel.app/booking'
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

// 綠界官方正確的 CheckMacValue 計算方式
function generateCheckMacValue(params: Record<string, string>): string {
  // 1. 將參數依照參數名稱 ASCII Code 編碼排序
  const sortedKeys = Object.keys(params).sort()
  
  // 2. 組合參數（不包含 CheckMacValue）
  let queryString = ''
  for (const key of sortedKeys) {
    if (key !== 'CheckMacValue' && params[key] !== '' && params[key] !== null && params[key] !== undefined) {
      queryString += `${key}=${params[key]}&`
    }
  }
  
  // 3. 移除最後一個 & 符號
  queryString = queryString.slice(0, -1)
  
  // 4. 最前面加上 HashKey，最後面加上 HashIV（綠界官方正確方式）
  const withKeys = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${queryString}&HashIV=${ECPAY_CONFIG.HASH_IV}`
  
  // 5. 進行 URL encode（使用舊版標準，空格編碼為 +）
  const urlEncoded = customUrlEncode(withKeys)
  
  // 6. 轉為小寫
  const lowerCase = urlEncoded.toLowerCase()
  
  // 7. 使用 SHA256 加密
  const hash = crypto.createHash('sha256').update(lowerCase).digest('hex')
  
  // 8. 轉為大寫
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

    // 產生訂單編號（格式：年月日時分秒 + 3位隨機數，限制在20字元內）
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2) // 只取年份後兩位
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    
    const orderNumber = `PEI${year}${month}${day}${hour}${minute}${second}${random}`

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
      ChoosePayment: 'ALL', // 改為 ALL，支援所有付款方式
      EncryptType: '1',
      Language: 'ZH-TW',
      // 添加綠界官方推薦的必要參數
      NeedExtraPaidInfo: 'N',
      Redeem: 'N',
      UnionPay: '0',
      IgnorePayment: 'WebATM#ATM#CVS#BARCODE',
      ExpireDate: '7',
      PaymentInfoURL: ECPAY_CONFIG.RETURN_URL,
      ClientRedirectURL: ECPAY_CONFIG.CLIENT_FRONT_URL
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
          orderNumber: orderNumber,
          expectedAmount: parseInt(amount) // 記錄預期金額
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