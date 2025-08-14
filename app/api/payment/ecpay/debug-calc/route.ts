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
      step1 += `${key}=${(params as any)[key]}&`
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

    // 嘗試不同的參數組合
    const alternativeParams = {
      ChoosePayment: 'ALL',
      EncryptType: '1',
      ItemName: 'Apple iphone 15',
      MerchantID: '3002607',
      MerchantTradeDate: '2023/03/12 15:30:23',
      MerchantTradeNo: 'ecpay20230312153023',
      PaymentType: 'aio',
      ReturnURL: 'https://www.ecpay.com.tw/receive.php',
      TotalAmount: '30000',
      TradeDesc: '促銷方案',
      // 嘗試添加可能遺漏的參數
      ClientBackURL: 'https://www.ecpay.com.tw/client_back_url.php',
      OrderResultURL: 'https://www.ecpay.com.tw/order_result_url.php'
    }

    const altSortedKeys = Object.keys(alternativeParams).sort()
    let altStep1 = ''
    for (const key of altSortedKeys) {
      altStep1 += `${key}=${(alternativeParams as any)[key]}&`
    }
    altStep1 = altStep1.slice(0, -1)

    const altStep2 = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${altStep1}&HashIV=${ECPAY_CONFIG.HASH_IV}`
    const altStep3 = encodeURIComponent(altStep2)
    const altStep4 = altStep3.toLowerCase()
    const altStep5 = crypto.createHash('sha256').update(altStep4).digest('hex')
    const altStep6 = altStep5.toUpperCase()

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CheckMacValue 計算調試</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .step { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background: #fafafa; }
          .code { background: #f4f4f4; padding: 10px; border-radius: 3px; font-family: monospace; white-space: pre-wrap; word-break: break-all; border-left: 4px solid #2196F3; }
          .success { color: #4CAF50; font-weight: bold; }
          .error { color: #f44336; font-weight: bold; }
          .expected { color: #2196F3; font-weight: bold; }
          .warning { color: #ff9800; font-weight: bold; }
          .header { background: #2196F3; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .comparison { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .test-button { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 5px; }
          .test-button:hover { background: #45a049; }
          .alternative { background: #e8f5e8; border: 1px solid #4CAF50; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .param-list { background: #f9f9f9; padding: 10px; border-radius: 3px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 CheckMacValue 計算調試工具</h1>
            <p>使用綠界官方範例參數進行精確比對</p>
          </div>

          <div class="step">
            <h3>📋 當前使用的參數</h3>
            <div class="param-list">
              ${Object.entries(params).map(([key, value]) => `<strong>${key}:</strong> ${value}`).join('<br>')}
            </div>
          </div>
          
          <div class="step">
            <h3>📋 步驟 1: 排序參數</h3>
            <p><strong>排序後的參數:</strong></p>
            <div class="code">${step1}</div>
          </div>
          
          <div class="step">
            <h3>🔑 步驟 2: 前面加 HashKey，後面加 HashIV</h3>
            <p><strong>HashKey:</strong> ${ECPAY_CONFIG.HASH_KEY}</p>
            <p><strong>HashIV:</strong> ${ECPAY_CONFIG.HASH_IV}</p>
            <div class="code">${step2}</div>
          </div>
          
          <div class="step">
            <h3>🌐 步驟 3: URL encode</h3>
            <div class="code">${step3}</div>
          </div>
          
          <div class="step">
            <h3>📝 步驟 4: 轉小寫</h3>
            <div class="code">${step4}</div>
          </div>
          
          <div class="step">
            <h3>🔐 步驟 5: SHA256 加密</h3>
            <div class="code">${step5}</div>
          </div>
          
          <div class="step">
            <h3>📊 步驟 6: 轉大寫 (我們的結果)</h3>
            <div class="code success">${step6}</div>
          </div>
          
          <div class="comparison">
            <h3>🎯 比對結果</h3>
            <p><strong>綠界官方預期:</strong></p>
            <div class="code expected">6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840</div>
            <p><strong>我們的結果:</strong></p>
            <div class="code ${step6 === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840' ? 'success' : 'error'}">${step6}</div>
            <p><strong>比對結果:</strong> 
              <span class="${step6 === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840' ? 'success' : 'error'}">
                ${step6 === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840' ? '✅ 完全一致！' : '❌ 不一致！'}
              </span>
            </p>
          </div>

          <div class="alternative">
            <h3>🔬 嘗試添加額外參數</h3>
            <p><strong>添加 ClientBackURL 和 OrderResultURL 後的結果:</strong></p>
            <div class="code">${altStep6}</div>
            <p><strong>是否匹配官方預期:</strong> 
              <span class="${altStep6 === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840' ? 'success' : 'error'}">
                ${altStep6 === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840' ? '✅ 是！' : '❌ 否'}
              </span>
            </p>
          </div>
          
          <div class="step">
            <h3>📈 詳細分析</h3>
            <p><strong>我們的結果長度:</strong> ${step6.length}</p>
            <p><strong>預期結果長度:</strong> 64</p>
            <p><strong>是否長度相同:</strong> ${step6.length === 64 ? '✅ 是' : '❌ 否'}</p>
            <p><strong>前10個字符:</strong> ${step6.substring(0, 10)} vs ${'6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840'.substring(0, 10)}</p>
            <p><strong>前10個字符是否相同:</strong> ${step6.substring(0, 10) === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840'.substring(0, 10) ? '✅ 是' : '❌ 否'}</p>
          </div>

          <div class="step">
            <h3>🧪 測試按鈕</h3>
            <button class="test-button" onclick="window.open('https://peiplay.vercel.app/api/payment/ecpay/urlencode-test', '_blank')">測試 URLEncode 工具</button>
            <button class="test-button" onclick="window.open('https://peiplay.vercel.app/api/payment/ecpay/official-exact', '_blank')">測試官方確切範例</button>
          </div>

          <div class="step">
            <h3>⚠️ 重要說明</h3>
            <ul>
              <li>此測試使用綠界官方範例參數</li>
              <li>如果比對結果一致，表示我們的 CheckMacValue 計算正確</li>
              <li>如果比對結果不一致，表示我們的計算邏輯有問題</li>
              <li>請檢查每個步驟的輸出，找出差異點</li>
              <li>我們也嘗試了添加額外參數來測試是否遺漏了必要參數</li>
            </ul>
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
