import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>綠界 URL 設定檢查指南</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background: #fafafa; }
        .header { background: #2196F3; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .step { margin: 15px 0; padding: 15px; border-left: 4px solid #2196F3; background: white; }
        .critical { border-left-color: #f44336; background: #ffebee; }
        .important { border-left-color: #ff9800; background: #fff3e0; }
        .success { border-left-color: #4CAF50; background: #e8f5e8; }
        .code { background: #f4f4f4; padding: 10px; border-radius: 3px; font-family: monospace; margin: 10px 0; }
        .highlight { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .note { background: #e3f2fd; border: 1px solid #2196F3; padding: 10px; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔧 綠界 URL 設定檢查指南</h1>
          <p>根據您的截圖，收款連結已建立，現在需要檢查 URL 設定</p>
        </div>

        <div class="section">
          <h2>✅ 已確認的設定</h2>
          <div class="success">
            <h3>收款連結狀態</h3>
            <ul>
              <li>✅ 連結名稱：「Peiplay 預約付款」</li>
              <li>✅ 狀態：「啟用」</li>
              <li>✅ 付款方式：信用卡、ATM、網路ATM、超商代碼、超商條碼、ApplePay</li>
              <li>✅ 信用卡審核：通過</li>
              <li>✅ 非信用卡審核：通過</li>
            </ul>
          </div>
        </div>

        <div class="section">
          <h2>🔍 需要檢查的 URL 設定</h2>
          
          <div class="step critical">
            <h3>方法 1：收款連結編輯</h3>
            <p><strong>步驟：</strong></p>
            <ol>
              <li>在「收款連結管理」頁面</li>
              <li>找到「Peiplay 預約付款」連結</li>
              <li>點擊「編輯」按鈕</li>
              <li>查看「回調設定」或「URL 設定」部分</li>
            </ol>
            <div class="code">
              需要設定的 URL：<br>
              ReturnURL: https://peiplay.vercel.app/api/payment/callback<br>
              ClientBackURL: https://peiplay.vercel.app/booking<br>
              ClientFrontURL: https://peiplay.vercel.app/booking
            </div>
          </div>

          <div class="step important">
            <h3>方法 2：系統介接設定</h3>
            <p><strong>步驟：</strong></p>
            <ol>
              <li>左側選單 → 「系統設定」</li>
              <li>點擊「系統介接設定」</li>
              <li>查看是否有 URL 設定選項</li>
            </ol>
          </div>

          <div class="step important">
            <h3>方法 3：商店基本資料</h3>
            <p><strong>步驟：</strong></p>
            <ol>
              <li>左側選單 → 「廠商專區」</li>
              <li>點擊「廠商基本資料」</li>
              <li>查看是否有「回調設定」或「URL 設定」</li>
            </ol>
          </div>
        </div>

        <div class="section">
          <h2>🎯 付款方式啟用檢查</h2>
          <div class="step success">
            <h3>已確認啟用的付款方式</h3>
            <p>從您的截圖可以看到，以下付款方式已啟用：</p>
            <div class="code">
              ✅ 信用卡(一次付清)<br>
              ✅ ATM 櫃員機<br>
              ✅ 網路ATM<br>
              ✅ 超商代碼<br>
              ✅ 超商條碼<br>
              ✅ ApplePay
            </div>
          </div>
        </div>

        <div class="section">
          <h2>🔧 可能的問題原因</h2>
          <div class="highlight">
            <h3>既然設定都正確，可能的問題：</h3>
            <ol>
              <li><strong>URL 設定缺失</strong>：收款連結中沒有設定正確的回調 URL</li>
              <li><strong>環境問題</strong>：綠界後端可能有暫時性問題</li>
              <li><strong>參數順序</strong>：雖然我們計算正確，但可能有其他參數問題</li>
              <li><strong>商店限制</strong>：可能有其他未顯示的限制</li>
            </ol>
          </div>
        </div>

        <div class="section">
          <h2>📞 建議行動</h2>
          <div class="note">
            <h3>立即檢查：</h3>
            <ol>
              <li><strong>編輯收款連結</strong>：檢查是否有 URL 設定選項</li>
              <li><strong>聯繫綠界客服</strong>：02-2655-1775</li>
              <li><strong>提供資料</strong>：
                <ul>
                  <li>商店代號：3464691</li>
                  <li>收款連結名稱：「Peiplay 預約付款」</li>
                  <li>錯誤代碼：10200073</li>
                  <li>我們的 CheckMacValue 計算結果</li>
                </ul>
              </li>
            </ol>
          </div>
        </div>

        <div class="section">
          <h2>🧪 測試建議</h2>
          <div class="code">
            <strong>可以嘗試：</strong><br>
            1. 使用綠界官方的收款連結直接測試<br>
            2. 檢查是否有其他商店使用相同設定成功<br>
            3. 確認所有付款方式的審核狀態<br>
            4. 檢查商店是否有任何限制或暫停
          </div>
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
}
