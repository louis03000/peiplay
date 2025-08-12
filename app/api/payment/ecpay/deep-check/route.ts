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

// 檢查可能的問題
function checkPotentialIssues() {
  const issues = []
  
  // 1. 檢查是否為測試環境配置
  if (ECPAY_CONFIG.MERCHANT_ID === '3464691') {
    issues.push({
      type: 'warning',
      title: '測試環境配置',
      description: '當前使用的是測試環境的 MerchantID，請確認是否應該使用正式環境配置',
      solution: '聯繫綠界客服確認正式環境的 MerchantID、HashKey、HashIV'
    })
  }
  
  // 2. 檢查回調網址格式
  if (!ECPAY_CONFIG.RETURN_URL.startsWith('https://')) {
    issues.push({
      type: 'error',
      title: '回調網址格式錯誤',
      description: '回調網址必須使用 HTTPS',
      solution: '確保所有回調網址都使用 HTTPS'
    })
  }
  
  // 3. 檢查網址是否為本地開發環境
  if (ECPAY_CONFIG.RETURN_URL.includes('localhost') || ECPAY_CONFIG.RETURN_URL.includes('127.0.0.1')) {
    issues.push({
      type: 'error',
      title: '本地開發環境',
      description: '綠界無法回調到本地開發環境',
      solution: '使用公網可訪問的網址'
    })
  }
  
  return issues
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
    
    const orderNumber = `DEEP${year}${month}${day}${hour}${minute}${second}${random}`

    // 測試不同的參數組合
    const testCases = [
      {
        name: '最簡化配置',
        params: {
          MerchantID: ECPAY_CONFIG.MERCHANT_ID,
          MerchantTradeNo: orderNumber,
          MerchantTradeDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
          PaymentType: 'aio',
          TotalAmount: '100',
          TradeDesc: '深度檢查測試',
          ItemName: 'PeiPlay 遊戲夥伴預約 - 深度檢查',
          ReturnURL: ECPAY_CONFIG.RETURN_URL,
          ChoosePayment: 'Credit',
          EncryptType: '1'
        }
      },
      {
        name: '完整配置',
        params: {
          MerchantID: ECPAY_CONFIG.MERCHANT_ID,
          MerchantTradeNo: orderNumber,
          MerchantTradeDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
          PaymentType: 'aio',
          TotalAmount: '100',
          TradeDesc: '深度檢查測試',
          ItemName: 'PeiPlay 遊戲夥伴預約 - 深度檢查',
          ReturnURL: ECPAY_CONFIG.RETURN_URL,
          ClientBackURL: ECPAY_CONFIG.CLIENT_BACK_URL,
          OrderResultURL: ECPAY_CONFIG.CLIENT_FRONT_URL,
          ChoosePayment: 'Credit',
          EncryptType: '1',
          Language: 'ZH-TW',
          NeedExtraPaidInfo: 'N',
          Redeem: 'N',
          UnionPay: '0',
          IgnorePayment: 'WebATM#ATM#CVS#BARCODE',
          ExpireDate: '7',
          PaymentInfoURL: ECPAY_CONFIG.RETURN_URL,
          ClientRedirectURL: ECPAY_CONFIG.CLIENT_FRONT_URL
        }
      }
    ]

    // 計算每個測試案例的 CheckMacValue
    testCases.forEach(testCase => {
      const sortedKeys = Object.keys(testCase.params).sort()
      let queryString = ''
      for (const key of sortedKeys) {
        const value = testCase.params[key as keyof typeof testCase.params]
        if (key !== 'CheckMacValue' && value !== '' && value !== null && value !== undefined) {
          queryString += `${key}=${value}&`
        }
      }
      queryString = queryString.slice(0, -1)
      // 最前面加上 HashKey，最後面加上 HashIV（綠界官方正確方式）
      const withKeys = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${queryString}&HashIV=${ECPAY_CONFIG.HASH_IV}`
      const urlEncoded = encodeURIComponent(withKeys)
      const lowerCase = urlEncoded.toLowerCase()
      const hash = crypto.createHash('sha256').update(lowerCase).digest('hex')
      ;(testCase.params as any).CheckMacValue = hash.toUpperCase()
    })

    const issues = checkPotentialIssues()

    const deepCheckHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>綠界深度檢查</title>
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
            max-width: 1200px; 
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
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
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
          .alert-info {
            background: #d1ecf1;
            border-color: #17a2b8;
            color: #0c5460;
          }
          .config {
            background: linear-gradient(135deg, #f3e5f5, #e1bee7);
            padding: 15px;
            border-radius: 10px;
            border-left: 5px solid #9c27b0;
            margin: 10px 0;
          }
          .test-button {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 25px;
            font-size: 16px;
            cursor: pointer;
            margin: 5px;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
          }
          .test-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
          }
          .issue {
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
            border-left: 5px solid;
          }
          .issue.error {
            background: #f8d7da;
            border-color: #dc3545;
            color: #721c24;
          }
          .issue.warning {
            background: #fff3cd;
            border-color: #ffc107;
            color: #856404;
          }
          pre {
            background: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.4;
            border-left: 4px solid #667eea;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 綠界金流深度檢查</h1>
            <p style="color: #666; font-size: 1.2em;">找出 CheckMacValue Error (10200073) 的根本原因</p>
          </div>
          
          <div class="alert alert-info">
            <strong>🎯 深度檢查目標：</strong> 系統性檢查所有可能被遺漏的配置問題
          </div>
          
          <div class="section">
            <h2>⚠️ 發現的潛在問題</h2>
            ${issues.length > 0 ? issues.map(issue => `
              <div class="issue ${issue.type}">
                <h4>${issue.title}</h4>
                <p><strong>問題描述：</strong> ${issue.description}</p>
                <p><strong>解決方案：</strong> ${issue.solution}</p>
              </div>
            `).join('') : '<div class="alert alert-success">✅ 未發現明顯的配置問題</div>'}
          </div>
          
          <div class="section">
            <h2>📋 當前配置詳情</h2>
            <div class="config">
              <p><strong>MerchantID:</strong> ${ECPAY_CONFIG.MERCHANT_ID}</p>
              <p><strong>HashKey:</strong> ${ECPAY_CONFIG.HASH_KEY}</p>
              <p><strong>HashIV:</strong> ${ECPAY_CONFIG.HASH_IV}</p>
              <p><strong>Payment URL:</strong> ${ECPAY_CONFIG.PAYMENT_URL}</p>
              <p><strong>Return URL:</strong> ${ECPAY_CONFIG.RETURN_URL}</p>
              <p><strong>Client Back URL:</strong> ${ECPAY_CONFIG.CLIENT_BACK_URL}</p>
              <p><strong>Client Front URL:</strong> ${ECPAY_CONFIG.CLIENT_FRONT_URL}</p>
            </div>
          </div>
          
          <div class="section">
            <h2>🧪 多種參數組合測試</h2>
            ${testCases.map((testCase, index) => `
              <div class="card">
                <h3>測試案例 ${index + 1}: ${testCase.name}</h3>
                <div class="config">
                  <p><strong>參數數量:</strong> ${Object.keys(testCase.params).length} 個</p>
                  <p><strong>CheckMacValue:</strong> ${(testCase.params as any).CheckMacValue}</p>
                </div>
                <pre>${JSON.stringify(testCase.params, null, 2)}</pre>
                <form method="POST" action="${ECPAY_CONFIG.PAYMENT_URL}" target="_blank">
                  ${Object.entries(testCase.params).map(([key, value]) => 
                    `<input type="hidden" name="${key}" value="${value}">`
                  ).join('')}
                  <button type="submit" class="test-button">測試 ${testCase.name}</button>
                </form>
              </div>
            `).join('')}
          </div>
          
          <div class="section">
            <h2>🔍 常見遺漏問題檢查</h2>
            <div class="grid">
              <div class="card">
                <h3>環境配置問題</h3>
                <ul>
                  <li>❓ 是否使用了正確的環境配置（測試/正式）</li>
                  <li>❓ 商店是否已開啟收款服務</li>
                  <li>❓ 是否已設定付款方式</li>
                  <li>❓ 回調網址是否已在綠界後台設定</li>
                  <li>❓ 商店狀態是否為啟用</li>
                </ul>
              </div>
              
              <div class="card">
                <h3>網路配置問題</h3>
                <ul>
                  <li>❓ 網址是否為公網可訪問</li>
                  <li>❓ 是否使用 HTTPS</li>
                  <li>❓ 防火牆是否阻擋</li>
                  <li>❓ DNS 解析是否正確</li>
                  <li>❓ SSL 證書是否有效</li>
                </ul>
              </div>
              
              <div class="card">
                <h3>參數配置問題</h3>
                <ul>
                  <li>❓ 參數格式是否正確</li>
                  <li>❓ 是否包含必要參數</li>
                  <li>❓ 參數值是否合法</li>
                  <li>❓ 編碼方式是否正確</li>
                  <li>❓ 時間格式是否正確</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h2>📞 聯繫綠界客服</h2>
            <div class="alert alert-warning">
              <strong>如果所有測試都失敗，請聯繫綠界客服確認以下項目：</strong>
              <ul>
                <li><strong>商店編號 (MerchantID):</strong> ${ECPAY_CONFIG.MERCHANT_ID}</li>
                <li><strong>HashKey:</strong> ${ECPAY_CONFIG.HASH_KEY}</li>
                <li><strong>HashIV:</strong> ${ECPAY_CONFIG.HASH_IV}</li>
                <li><strong>商店狀態:</strong> 是否已啟用收款服務</li>
                <li><strong>付款方式:</strong> 是否已設定信用卡付款</li>
                <li><strong>回調網址:</strong> ${ECPAY_CONFIG.RETURN_URL}</li>
                <li><strong>環境設定:</strong> 是否為正式環境</li>
                <li><strong>API 權限:</strong> 是否已開啟</li>
              </ul>
            </div>
          </div>
          
          <div class="alert alert-danger">
            <strong>重要提醒：</strong> CheckMacValue Error (10200073) 通常表示綠界後台配置問題。如果所有測試都失敗，請務必聯繫綠界客服確認配置。
          </div>
        </div>
      </body>
      </html>
    `

    return new NextResponse(deepCheckHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Deep check error:', error)
    return NextResponse.json(
      { error: '深度檢查失敗' },
      { status: 500 }
    )
  }
}
