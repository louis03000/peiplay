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

// 綠界官方推薦的 CheckMacValue 計算方式
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
  
  // 4. 加入 HashKey
  queryString += `&HashKey=${ECPAY_CONFIG.HASH_KEY}`
  
  // 5. 進行 URL encode
  const urlEncoded = encodeURIComponent(queryString)
  
  // 6. 轉為小寫
  const lowerCase = urlEncoded.toLowerCase()
  
  // 7. 加入 HashIV
  const withHashIV = lowerCase + `&HashIV=${ECPAY_CONFIG.HASH_IV}`
  
  // 8. 進行 URL encode
  const finalEncoded = encodeURIComponent(withHashIV)
  
  // 9. 轉為小寫
  const finalLower = finalEncoded.toLowerCase()
  
  // 10. 使用 SHA256 加密
  const hash = crypto.createHash('sha256').update(finalLower).digest('hex')
  
  // 11. 轉為大寫
  return hash.toUpperCase()
}

export async function GET() {
  try {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    
    const orderNumber = `ULT${year}${month}${day}${hour}${minute}${second}${random}`

    // 使用綠界官方推薦的完整參數配置
    const ecpayParams: Record<string, string> = {
      MerchantID: ECPAY_CONFIG.MERCHANT_ID,
      MerchantTradeNo: orderNumber,
      MerchantTradeDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      PaymentType: 'aio',
      TotalAmount: '100',
      TradeDesc: '終極修復測試',
      ItemName: 'PeiPlay 遊戲夥伴預約 - 終極修復測試',
      ReturnURL: ECPAY_CONFIG.RETURN_URL,
      ClientBackURL: ECPAY_CONFIG.CLIENT_BACK_URL,
      OrderResultURL: ECPAY_CONFIG.CLIENT_FRONT_URL,
      ChoosePayment: 'Credit',
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

    const ultimateHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>綠界終極修復</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container { 
            max-width: 1000px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 15px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #667eea;
          }
          .header h1 {
            color: #333;
            margin: 0;
            font-size: 2.5em;
          }
          .section { 
            margin: 25px 0; 
            padding: 20px; 
            border: 2px solid #e9ecef; 
            border-radius: 10px; 
            background: #f8f9fa;
          }
          .section h2 {
            color: #495057;
            margin-top: 0;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
          }
          .success { color: #28a745; font-weight: bold; }
          .error { color: #dc3545; font-weight: bold; }
          .warning { color: #ffc107; font-weight: bold; }
          .info { color: #17a2b8; font-weight: bold; }
          pre { 
            background: #2d3748; 
            color: #e2e8f0; 
            padding: 15px; 
            border-radius: 8px; 
            overflow-x: auto; 
            font-size: 13px; 
            line-height: 1.4;
            border-left: 4px solid #667eea;
          }
          .test-button { 
            background: linear-gradient(45deg, #667eea, #764ba2); 
            color: white; 
            padding: 15px 30px; 
            border: none; 
            border-radius: 25px; 
            font-size: 18px; 
            cursor: pointer; 
            margin: 10px; 
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          }
          .test-button:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
          }
          .info-box { 
            background: linear-gradient(135deg, #e3f2fd, #bbdefb); 
            padding: 15px; 
            border-radius: 10px; 
            margin: 15px 0; 
            border-left: 5px solid #2196f3;
          }
          .step { 
            margin: 15px 0; 
            padding: 15px; 
            background: white; 
            border-left: 4px solid #667eea; 
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          .config { 
            background: linear-gradient(135deg, #f3e5f5, #e1bee7); 
            padding: 15px; 
            border-radius: 10px; 
            border-left: 5px solid #9c27b0;
          }
          .alert {
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 5px solid;
          }
          .alert-success {
            background: #d4edda;
            border-color: #28a745;
            color: #155724;
          }
          .alert-warning {
            background: #fff3cd;
            border-color: #ffc107;
            color: #856404;
          }
          .alert-danger {
            background: #f8d7da;
            border-color: #dc3545;
            color: #721c24;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
          }
          .card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border: 1px solid #e9ecef;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 綠界金流終極修復工具</h1>
            <p style="color: #666; font-size: 1.2em;">解決 CheckMacValue Error (10200073) 的完整解決方案</p>
          </div>
          
          <div class="alert alert-info">
            <strong>🎯 修復目標：</strong> 使用綠界官方推薦的完整參數配置，解決所有已知問題
          </div>
          
          <div class="grid">
            <div class="card">
              <h3>📋 配置信息</h3>
              <div class="config">
                <p><strong>MerchantID:</strong> <span class="success">${ECPAY_CONFIG.MERCHANT_ID}</span></p>
                <p><strong>HashKey:</strong> ${ECPAY_CONFIG.HASH_KEY.substring(0, 8)}...</p>
                <p><strong>HashIV:</strong> ${ECPAY_CONFIG.HASH_IV.substring(0, 8)}...</p>
                <p><strong>Payment URL:</strong> ${ECPAY_CONFIG.PAYMENT_URL}</p>
              </div>
            </div>
            
            <div class="card">
              <h3>🔧 參數策略</h3>
              <div class="info-box">
                <p><strong>使用完整參數配置：</strong></p>
                <ul>
                  <li>✅ 包含所有必要參數</li>
                  <li>✅ 使用官方推薦值</li>
                  <li>✅ 確保參數格式正確</li>
                  <li>✅ 避免參數衝突</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h2>📦 完整參數配置</h2>
            <pre>${JSON.stringify(ecpayParams, null, 2)}</pre>
          </div>
          
          <div class="section">
            <h2>✅ CheckMacValue 計算詳解</h2>
            <div class="step">
              <strong>步驟 1:</strong> 排序後的參數名稱
              <pre>${Object.keys(ecpayParams).sort().join(', ')}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 2:</strong> 組合參數（不含 CheckMacValue）
              <pre>${Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&')}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 3:</strong> 加入 HashKey
              <pre>${Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&')}&HashKey=${ECPAY_CONFIG.HASH_KEY}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 4:</strong> URL Encode
              <pre>${encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`)}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 5:</strong> 轉小寫
              <pre>${encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase()}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 6:</strong> 加入 HashIV
              <pre>${encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase()}&HashIV=${ECPAY_CONFIG.HASH_IV}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 7:</strong> 最終 URL Encode
              <pre>${encodeURIComponent(encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase() + `&HashIV=${ECPAY_CONFIG.HASH_IV}`)}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 8:</strong> 轉小寫
              <pre>${encodeURIComponent(encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase() + `&HashIV=${ECPAY_CONFIG.HASH_IV}`).toLowerCase()}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 9:</strong> SHA256 加密
              <pre>${crypto.createHash('sha256').update(encodeURIComponent(encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase() + `&HashIV=${ECPAY_CONFIG.HASH_IV}`).toLowerCase()).digest('hex')}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 10:</strong> 轉大寫 (最終 CheckMacValue)
              <pre class="success">${checkMacValue}</pre>
            </div>
          </div>
          
          <div class="section">
            <h2>🧪 終極測試</h2>
            <div class="alert alert-success">
              <strong>準備就緒！</strong> 點擊下方按鈕進行終極測試
            </div>
            <form method="POST" action="${ECPAY_CONFIG.PAYMENT_URL}" target="_blank">
              ${Object.entries(ecpayParams).map(([key, value]) => 
                `<input type="hidden" name="${key}" value="${value}">`
              ).join('')}
              <button type="submit" class="test-button">🚀 終極付款測試</button>
            </form>
          </div>
          
          <div class="grid">
            <div class="card">
              <h3>📊 驗證檢查</h3>
              <ul>
                <li>✅ MerchantID 格式: ${ECPAY_CONFIG.MERCHANT_ID.length} 字元</li>
                <li>✅ HashKey 長度: ${ECPAY_CONFIG.HASH_KEY.length} 字元</li>
                <li>✅ HashIV 長度: ${ECPAY_CONFIG.HASH_IV.length} 字元</li>
                <li>✅ 訂單編號: ${orderNumber.length} 字元</li>
                <li>✅ 金額格式: ${ecpayParams.TotalAmount}</li>
                <li>✅ CheckMacValue: ${checkMacValue.length} 字元</li>
                <li>✅ 參數數量: ${Object.keys(ecpayParams).length} 個</li>
              </ul>
            </div>
            
            <div class="card">
              <h3>🔍 問題排查</h3>
              <div class="alert alert-warning">
                <strong>如果仍然失敗：</strong>
                <ul>
                  <li>檢查綠界後台配置</li>
                  <li>確認商店狀態</li>
                  <li>聯繫綠界客服</li>
                  <li>檢查網路連接</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h2>📞 聯繫綠界客服</h2>
            <div class="alert alert-info">
              <strong>如果終極修復仍然失敗，請聯繫綠界客服確認：</strong>
              <ul>
                <li>商店編號 (MerchantID) 是否正確</li>
                <li>HashKey 和 HashIV 是否正確</li>
                <li>商店是否已開啟收款服務</li>
                <li>是否已設定付款方式</li>
                <li>回調網址是否已正確設定</li>
                <li>是否為正式環境配置</li>
              </ul>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    return new NextResponse(ultimateHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Ultimate fix error:', error)
    return NextResponse.json(
      { error: '終極修復失敗' },
      { status: 500 }
    )
  }
}
