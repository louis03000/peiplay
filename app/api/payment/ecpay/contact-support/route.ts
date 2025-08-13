import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supportInfoHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>聯繫綠界客服 - 技術資訊</title>
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
        .code-block {
          background: #2d3748;
          color: #e2e8f0;
          padding: 15px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 14px;
          line-height: 1.4;
          border-left: 4px solid #667eea;
          margin: 10px 0;
        }
        .alert {
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          border-left: 5px solid;
        }
        .alert-info {
          background: #d1ecf1;
          border-color: #17a2b8;
          color: #0c5460;
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
        .copy-button {
          background: #667eea;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
          font-size: 12px;
        }
        .copy-button:hover {
          background: #5a67d8;
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
          <h1>📞 聯繫綠界客服</h1>
          <p style="color: #666; font-size: 1.2em;">技術資訊收集工具</p>
        </div>
        
        <div class="alert alert-danger">
          <strong>🚨 問題確認：</strong> 所有測試工具都出現 CheckMacValue Error (10200073)，問題可能是綠界後台配置。
        </div>
        
        <div class="section">
          <h2>🔧 技術配置資訊</h2>
          <p>請將以下資訊提供給綠界客服：</p>
          
          <div class="code-block">
            <strong>商店編號 (MerchantID):</strong> 3464691
            <button class="copy-button" onclick="navigator.clipboard.writeText('3464691')">複製</button>
          </div>
          
          <div class="code-block">
            <strong>HashKey:</strong> ilByxKjPNI9qpHBK
            <button class="copy-button" onclick="navigator.clipboard.writeText('ilByxKjPNI9qpHBK')">複製</button>
          </div>
          
          <div class="code-block">
            <strong>HashIV:</strong> OTzB3pify1U9G0j6
            <button class="copy-button" onclick="navigator.clipboard.writeText('OTzB3pify1U9G0j6')">複製</button>
          </div>
          
          <div class="code-block">
            <strong>回調網址 (ReturnURL):</strong> https://peiplay.vercel.app/api/payment/callback
            <button class="copy-button" onclick="navigator.clipboard.writeText('https://peiplay.vercel.app/api/payment/callback')">複製</button>
          </div>
          
          <div class="code-block">
            <strong>付款網址:</strong> https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5
            <button class="copy-button" onclick="navigator.clipboard.writeText('https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5')">複製</button>
          </div>
        </div>
        
        <div class="section">
          <h2>❓ 需要確認的問題</h2>
          <div class="grid">
            <div class="card">
              <h3>🏪 商店狀態</h3>
              <ul>
                <li>商店是否已啟用收款服務？</li>
                <li>商店是否已通過綠界審核？</li>
                <li>商店狀態是否為「啟用」？</li>
              </ul>
            </div>
            
            <div class="card">
              <h3>💳 付款方式</h3>
              <ul>
                <li>是否已設定信用卡付款？</li>
                <li>信用卡付款是否已啟用？</li>
                <li>是否有設定付款金額限制？</li>
              </ul>
            </div>
            
            <div class="card">
              <h3>🌐 環境配置</h3>
              <ul>
                <li>是否在正確的環境（測試/正式）？</li>
                <li>HashKey 和 HashIV 是否正確？</li>
                <li>回調網址是否已正確設定？</li>
              </ul>
            </div>
            
            <div class="card">
              <h3>🔗 串接設定</h3>
              <ul>
                <li>CheckMacValue 計算方式是否正確？</li>
                <li>參數格式是否符合要求？</li>
                <li>是否有遺漏必要參數？</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>📋 測試記錄</h2>
          <div class="alert alert-info">
            <strong>已測試的工具：</strong>
            <ul>
              <li>✅ 最終診斷工具 (final-diagnosis) - 14字元訂單編號</li>
              <li>✅ 超簡化測試工具 (ultra-simple) - 15字元訂單編號</li>
              <li>✅ 官方範例測試工具 (ecpay-example) - 12字元訂單編號</li>
              <li>✅ 所有工具都使用正確的 CheckMacValue 計算方式</li>
              <li>❌ 所有工具都出現 CheckMacValue Error (10200073)</li>
            </ul>
          </div>
        </div>
        
        <div class="section">
          <h2>📞 聯繫方式</h2>
          <div class="alert alert-success">
            <strong>綠界客服聯繫方式：</strong>
            <ul>
              <li><strong>客服專線：</strong> 02-2655-1775</li>
              <li><strong>客服時間：</strong> 週一至週五 09:00-18:00</li>
              <li><strong>線上客服：</strong> <a href="https://www.ecpay.com.tw/Service/Contact" target="_blank">綠界官網客服</a></li>
              <li><strong>技術文件：</strong> <a href="https://www.ecpay.com.tw/Service/API_Dwnld" target="_blank">綠界技術文件</a></li>
            </ul>
          </div>
        </div>
        
        <div class="alert alert-warning">
          <strong>💡 建議：</strong> 
          <ul>
            <li>聯繫客服時，請提供上述所有技術配置資訊</li>
            <li>說明已測試多個工具但都出現 CheckMacValue Error</li>
            <li>請求客服協助檢查商店配置和環境設定</li>
            <li>確認是否需要重新設定 HashKey 和 HashIV</li>
          </ul>
        </div>
      </div>
      
      <script>
        // 複製功能
        document.querySelectorAll('.copy-button').forEach(button => {
          button.addEventListener('click', function() {
            const text = this.previousElementSibling.textContent.split(': ')[1];
            navigator.clipboard.writeText(text).then(() => {
              this.textContent = '已複製！';
              setTimeout(() => {
                this.textContent = '複製';
              }, 2000);
            });
          });
        });
      </script>
    </body>
    </html>
  `

  return new NextResponse(supportInfoHtml, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}
