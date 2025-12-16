/**
 * 測試預聊系統 meta endpoint 和訊息更新
 * 
 * 使用方法：
 * node scripts/test-pre-chat-meta.js <chatId> <sessionToken>
 * 
 * 或直接測試 meta endpoint：
 * curl http://localhost:3000/api/chatrooms/{chatId}/meta
 */

const chatId = process.argv[2];
const sessionToken = process.argv[3];

if (!chatId) {
  console.log('使用方法: node scripts/test-pre-chat-meta.js <chatId> [sessionToken]');
  process.exit(1);
}

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testMetaEndpoint() {
  console.log('🧪 測試 meta endpoint...');
  
  const url = `${API_URL}/api/chatrooms/${chatId}/meta`;
  const headers = sessionToken 
    ? { 'Cookie': `next-auth.session-token=${sessionToken}` }
    : {};
  
  try {
    const start = Date.now();
    const res = await fetch(url, { headers });
    const duration = Date.now() - start;
    
    if (res.ok) {
      const data = await res.json();
      console.log('✅ Meta endpoint 回應:', data);
      console.log(`⏱️  回應時間: ${duration}ms`);
      
      if (duration > 50) {
        console.warn('⚠️  回應時間超過 50ms，建議檢查索引');
      } else {
        console.log('✅ 回應時間符合要求 (< 50ms)');
      }
      
      // 驗證欄位
      const requiredFields = ['lastMessageAt', 'messageCount', 'isClosed'];
      const missingFields = requiredFields.filter(field => !(field in data));
      
      if (missingFields.length > 0) {
        console.error('❌ 缺少必要欄位:', missingFields);
      } else {
        console.log('✅ 所有必要欄位都存在');
      }
    } else {
      const error = await res.json();
      console.error('❌ Meta endpoint 失敗:', res.status, error);
    }
  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  }
}

async function testMessageUpdate() {
  console.log('\n🧪 測試訊息更新是否會更新 meta...');
  
  // 先獲取初始 meta
  const initialMeta = await fetch(`${API_URL}/api/chatrooms/${chatId}/meta`).then(r => r.json());
  console.log('初始 meta:', initialMeta);
  
  // 發送測試訊息（需要實際的 session）
  if (!sessionToken) {
    console.log('⚠️  需要 session token 才能測試訊息更新');
    return;
  }
  
  // 這裡只是示範，實際需要有效的 session
  console.log('💡 提示：手動發送一則訊息後，再次檢查 meta 是否更新');
}

// 執行測試
testMetaEndpoint().then(() => {
  testMessageUpdate();
});

