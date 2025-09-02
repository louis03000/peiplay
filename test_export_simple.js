// 簡單的匯出功能測試
console.log('🧪 測試匯出功能...');

// 檢查檔案是否存在
const fs = require('fs');
const path = require('path');

const exportFile = path.join(__dirname, 'app', 'api', 'orders', 'export', 'route.ts');

if (fs.existsSync(exportFile)) {
  console.log('✅ 匯出檔案存在');
  
  // 檢查檔案內容
  const content = fs.readFileSync(exportFile, 'utf8');
  
  // 檢查關鍵變數是否正確宣告
  if (content.includes('const settlementSheet = workbook.addWorksheet')) {
    console.log('✅ settlementSheet 變數宣告正確');
  } else {
    console.log('❌ settlementSheet 變數宣告有問題');
  }
  
  if (content.includes('settlementSheet.addRow')) {
    console.log('✅ settlementSheet 使用正確');
  } else {
    console.log('❌ settlementSheet 使用有問題');
  }
  
  if (content.includes('夥伴收入結算')) {
    console.log('✅ 夥伴收入結算工作表名稱正確');
  } else {
    console.log('❌ 夥伴收入結算工作表名稱有問題');
  }
  
  console.log('📊 檔案大小:', fs.statSync(exportFile).size, 'bytes');
  
} else {
  console.log('❌ 匯出檔案不存在');
}

console.log('🎯 測試完成！');
