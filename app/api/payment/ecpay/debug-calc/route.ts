import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const ECPAY_CONFIG = {
  MERCHANT_ID: '3002607',
  HASH_KEY: 'pwFHCqoQZGmho4w6',
  HASH_IV: 'EkRm7iFT261dpevs'
}

export async function GET() {
  try {
    // 綠界官方範例參數
    const params = {
      ChoosePayment: 'ALL',
      EncryptType: '1',
      ItemName: 'Apple iphone 15',
      MerchantID: '3002607',
      MerchantTradeDate: '2023/03/12 15:30:23',
      MerchantTradeNo: 'ecpay20230312153023',
      PaymentType: 'aio',
      ReturnURL: 'https://www.ecpay.com.tw/receive.php',
      TotalAmount: '30000',
      TradeDesc: '促銷方案'
    }

    // 步驟 1: 排序參數
    const sortedKeys = Object.keys(params).sort()
    let step1 = ''
    for (const key of sortedKeys) {
      step1 += `${key}=${params[key]}&`
    }
    step1 = step1.slice(0, -1)

    // 步驟 2: 前面加 HashKey，後面加 HashIV
    const step2 = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${step1}&HashIV=${ECPAY_CONFIG.HASH_IV}`

    // 步驟 3: URL encode
    const step3 = encodeURIComponent(step2)

    // 步驟 4: 轉小寫
    const step4 = step3.toLowerCase()

    // 步驟 5: SHA256 加密
    const step5 = crypto.createHash('sha256').update(step4).digest('hex')

    // 步驟 6: 轉大寫
    const step6 = step5.toUpperCase()

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CheckMacValue 計算調試</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 1200px; margin: 0 auto; }
          .step { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .code { background: #f4f4f4; padding: 10px; border-radius: 3px; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
          .success { color: #4CAF50; font-weight: bold; }
          .error { color: #f44336; font-weight: bold; }
          .expected { color: #2196F3; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 CheckMacValue 計算調試</h1>
          
          <div class="step">
            <h3>步驟 1: 排序參數</h3>
            <div class="code">${step1}</div>
          </div>
          
          <div class="step">
            <h3>步驟 2: 前面加 HashKey，後面加 HashIV</h3>
            <div class="code">${step2}</div>
          </div>
          
          <div class="step">
            <h3>步驟 3: URL encode</h3>
            <div class="code">${step3}</div>
          </div>
          
          <div class="step">
            <h3>步驟 4: 轉小寫</h3>
            <div class="code">${step4}</div>
          </div>
          
          <div class="step">
            <h3>步驟 5: SHA256 加密</h3>
            <div class="code">${step5}</div>
          </div>
          
          <div class="step">
            <h3>步驟 6: 轉大寫 (我們的結果)</h3>
            <div class="code success">${step6}</div>
          </div>
          
          <div class="step">
            <h3>綠界官方預期結果</h3>
            <div class="code expected">6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840</div>
          </div>
          
          <div class="step">
            <h3>比對結果</h3>
            <div class="${step6 === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840' ? 'success' : 'error'}">
              ${step6 === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840' ? '✅ 完全一致！' : '❌ 不一致！'}
            </div>
          </div>
          
          <div class="step">
            <h3>詳細分析</h3>
            <p><strong>我們的結果長度:</strong> ${step6.length}</p>
            <p><strong>預期結果長度:</strong> 64</p>
            <p><strong>是否長度相同:</strong> ${step6.length === 64 ? '是' : '否'}</p>
            <p><strong>前10個字符:</strong> ${step6.substring(0, 10)} vs ${'6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840'.substring(0, 10)}</p>
          </div>
        </div>
      </body>
      </html>
    `
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error) {
    console.error('Debug calc error:', error)
    return NextResponse.json(
      { error: '計算調試失敗' },
      { status: 500 }
    )
  }
}
