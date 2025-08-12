import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
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

    const diagnoseHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>綠界診斷工具</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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
            border-bottom: 3px solid #f093fb;
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
            border-bottom: 2px solid #f093fb;
            padding-bottom: 10px;
          }
          .success { color: #28a745; font-weight: bold; }
          .error { color: #dc3545; font-weight: bold; }
          .warning { color: #ffc107; font-weight: bold; }
          .info { color: #17a2b8; font-weight: bold; }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
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
            background: linear-gradient(45deg, #f093fb, #f5576c);
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
            box-shadow: 0 6px 20px rgba(240, 147, 251, 0.4);
          }
          .checklist {
            list-style: none;
            padding: 0;
          }
          .checklist li {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .checklist li:before {
            content: "✓";
            color: #28a745;
            font-weight: bold;
            margin-right: 10px;
          }
          .checklist li.error:before {
            content: "✗";
            color: #dc3545;
          }
          .checklist li.warning:before {
            content: "⚠";
            color: #ffc107;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 綠界金流診斷工具</h1>
            <p style="color: #666; font-size: 1.2em;">全面檢查 CheckMacValue Error (10200073) 的可能原因</p>
          </div>
          
          <div class="alert alert-info">
            <strong>🎯 診斷目標：</strong> 系統性檢查所有可能導致 CheckMacValue Error 的原因
          </div>
          
          <div class="grid">
            <div class="card">
              <h3>📋 基本配置檢查</h3>
              <div class="config">
                <p><strong>MerchantID:</strong> <span class="${ECPAY_CONFIG.MERCHANT_ID.length === 7 ? 'success' : 'error'}">${ECPAY_CONFIG.MERCHANT_ID} (${ECPAY_CONFIG.MERCHANT_ID.length} 字元)</span></p>
                <p><strong>HashKey:</strong> <span class="${ECPAY_CONFIG.HASH_KEY.length === 16 ? 'success' : 'error'}">${ECPAY_CONFIG.HASH_KEY.substring(0, 8)}... (${ECPAY_CONFIG.HASH_KEY.length} 字元)</span></p>
                <p><strong>HashIV:</strong> <span class="${ECPAY_CONFIG.HASH_IV.length === 16 ? 'success' : 'error'}">${ECPAY_CONFIG.HASH_IV.substring(0, 8)}... (${ECPAY_CONFIG.HASH_IV.length} 字元)</span></p>
                <p><strong>Payment URL:</strong> <span class="${ECPAY_CONFIG.PAYMENT_URL.includes('payment.ecpay.com.tw') ? 'success' : 'error'}">${ECPAY_CONFIG.PAYMENT_URL}</span></p>
              </div>
            </div>
            
            <div class="card">
              <h3>🔗 回調網址檢查</h3>
              <div class="config">
                <p><strong>Return URL:</strong> <span class="${ECPAY_CONFIG.RETURN_URL.includes('peiplay.vercel.app') ? 'success' : 'error'}">${ECPAY_CONFIG.RETURN_URL}</span></p>
                <p><strong>Client Back URL:</strong> <span class="${ECPAY_CONFIG.CLIENT_BACK_URL.includes('peiplay.vercel.app') ? 'success' : 'error'}">${ECPAY_CONFIG.CLIENT_BACK_URL}</span></p>
                <p><strong>Client Front URL:</strong> <span class="${ECPAY_CONFIG.CLIENT_FRONT_URL.includes('peiplay.vercel.app') ? 'success' : 'error'}">${ECPAY_CONFIG.CLIENT_FRONT_URL}</span></p>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h2>🔍 常見問題檢查清單</h2>
            <div class="grid">
              <div class="card">
                <h3>✅ 程式碼層面</h3>
                <ul class="checklist">
                  <li>CheckMacValue 計算邏輯正確</li>
                  <li>參數排序按 ASCII 編碼</li>
                  <li>URL Encode 處理正確</li>
                  <li>SHA256 加密正確</li>
                  <li>所有參數為字符串類型</li>
                  <li>移除空值和 CheckMacValue</li>
                </ul>
              </div>
              
              <div class="card">
                <h3>⚠️ 配置層面</h3>
                <ul class="checklist">
                  <li class="warning">商店是否已開啟收款服務</li>
                  <li class="warning">是否已設定付款方式</li>
                  <li class="warning">回調網址是否已設定</li>
                  <li class="warning">是否為正式環境配置</li>
                  <li class="warning">商店狀態是否正常</li>
                  <li class="warning">API 權限是否正確</li>
                </ul>
              </div>
              
              <div class="card">
                <h3>❌ 網路層面</h3>
                <ul class="checklist">
                  <li class="error">網路連接是否穩定</li>
                  <li class="error">防火牆是否阻擋</li>
                  <li class="error">DNS 解析是否正確</li>
                  <li class="error">SSL 證書是否有效</li>
                  <li class="error">代理設定是否正確</li>
                  <li class="error">瀏覽器快取問題</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h2>🧪 測試工具</h2>
            <div class="grid">
              <div class="card">
                <h3>基本測試</h3>
                <a href="/api/payment/ecpay/verify-fix" class="test-button" target="_blank">簡化參數測試</a>
                <a href="/api/payment/ecpay/ultimate-fix" class="test-button" target="_blank">完整參數測試</a>
              </div>
              
              <div class="card">
                <h3>配置檢查</h3>
                <a href="/api/payment/ecpay/config-check" class="test-button" target="_blank">配置檢查</a>
                <a href="/api/payment/ecpay/debug" class="test-button" target="_blank">調試工具</a>
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
              </ul>
            </div>
          </div>
          
          <div class="section">
            <h2>🔧 修復建議</h2>
            <div class="grid">
              <div class="card">
                <h3>立即嘗試</h3>
                <div class="alert alert-success">
                  <ul>
                    <li>清除瀏覽器快取</li>
                    <li>使用無痕模式測試</li>
                    <li>嘗試不同瀏覽器</li>
                    <li>檢查網路連接</li>
                  </ul>
                </div>
              </div>
              
              <div class="card">
                <h3>技術檢查</h3>
                <div class="alert alert-info">
                  <ul>
                    <li>檢查 CheckMacValue 計算</li>
                    <li>驗證參數格式</li>
                    <li>確認編碼方式</li>
                    <li>測試不同參數組合</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div class="alert alert-danger">
            <strong>重要提醒：</strong> CheckMacValue Error (10200073) 通常表示綠界後台配置問題，而不是程式碼問題。如果所有測試都失敗，請務必聯繫綠界客服確認配置。
          </div>
        </div>
      </body>
      </html>
    `

    return new NextResponse(diagnoseHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Diagnose error:', error)
    return NextResponse.json(
      { error: '診斷失敗' },
      { status: 500 }
    )
  }
}
