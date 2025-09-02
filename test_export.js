const fetch = require('node-fetch');

async function testExport() {
  try {
    console.log('🧪 測試消費紀錄匯出功能...');
    
    // 測試匯出端點
    const response = await fetch('http://localhost:3000/api/orders/export', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      console.log('✅ 匯出成功！');
      console.log('📊 回應狀態:', response.status);
      console.log('📄 內容類型:', response.headers.get('content-type'));
      console.log('📁 檔案名稱:', response.headers.get('content-disposition'));
      
      // 下載檔案
      const buffer = await response.buffer();
      console.log('💾 檔案大小:', buffer.length, 'bytes');
      
      // 保存到本地
      const fs = require('fs');
      fs.writeFileSync('test_export.xlsx', buffer);
      console.log('💾 檔案已保存為 test_export.xlsx');
      
    } else {
      console.error('❌ 匯出失敗:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('錯誤詳情:', errorText);
    }
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

// 執行測試
testExport();
