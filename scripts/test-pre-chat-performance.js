/**
 * 預聊系統效能測試腳本
 * 
 * 使用方法：
 * node scripts/test-pre-chat-performance.js <chatId> [sessionToken]
 * 
 * 或設定環境變數：
 * CHAT_ID=xxx SESSION_TOKEN=xxx node scripts/test-pre-chat-performance.js
 */

const chatId = process.env.CHAT_ID || process.argv[2];
const sessionToken = process.env.SESSION_TOKEN || process.argv[3];
const API_URL = process.env.API_URL || 'http://localhost:3000';

if (!chatId) {
  console.error('❌ 錯誤：需要提供 chatId');
  console.log('\n使用方法:');
  console.log('  node scripts/test-pre-chat-performance.js <chatId> [sessionToken]');
  console.log('  或');
  console.log('  CHAT_ID=xxx SESSION_TOKEN=xxx node scripts/test-pre-chat-performance.js');
  process.exit(1);
}

const headers = sessionToken
  ? { 'Cookie': `next-auth.session-token=${sessionToken}` }
  : {};

async function testMetaEndpoint() {
  console.log('\n🧪 測試 1: Meta Endpoint 效能');
  console.log('─'.repeat(50));
  
  const url = `${API_URL}/api/chatrooms/${chatId}/meta`;
  
  try {
    const times = [];
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      const res = await fetch(url, { headers });
      const duration = Date.now() - start;
      times.push(duration);
      
      if (res.ok) {
        const data = await res.json();
        console.log(`  請求 ${i + 1}: ${duration}ms - ${JSON.stringify(data)}`);
      } else {
        const error = await res.json();
        console.error(`  ❌ 請求 ${i + 1} 失敗: ${res.status}`, error);
        return false;
      }
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    console.log(`\n  📊 統計:`);
    console.log(`    平均: ${avg.toFixed(1)}ms`);
    console.log(`    最小: ${min}ms`);
    console.log(`    最大: ${max}ms`);
    
    if (avg < 100) {
      console.log(`  ✅ 平均回應時間符合要求 (< 100ms)`);
    } else {
      console.log(`  ⚠️  平均回應時間超過 100ms，建議檢查索引`);
    }
    
    // 驗證欄位
    const res = await fetch(url, { headers });
    const data = await res.json();
    const requiredFields = ['lastMessageAt', 'messageCount', 'isClosed'];
    const missingFields = requiredFields.filter(field => !(field in data));
    
    if (missingFields.length > 0) {
      console.log(`  ❌ 缺少必要欄位: ${missingFields.join(', ')}`);
      return false;
    } else {
      console.log(`  ✅ 所有必要欄位都存在`);
    }
    
    return true;
  } catch (error) {
    console.error(`  ❌ 測試失敗:`, error.message);
    return false;
  }
}

async function testMessageUpdate() {
  console.log('\n🧪 測試 2: 訊息更新是否更新 Meta');
  console.log('─'.repeat(50));
  
  if (!sessionToken) {
    console.log('  ⚠️  需要 session token 才能測試訊息更新');
    console.log('  💡 提示：手動發送一則訊息後，再次檢查 meta 是否更新');
    return true;
  }
  
  try {
    // 1. 獲取初始 meta
    const initialRes = await fetch(`${API_URL}/api/chatrooms/${chatId}/meta`, { headers });
    const initialMeta = await initialRes.json();
    console.log(`  初始 meta:`, initialMeta);
    
    // 2. 發送測試訊息
    const testContent = `測試訊息 ${Date.now()}`;
    console.log(`  發送測試訊息: "${testContent}"`);
    
    const postRes = await fetch(`${API_URL}/api/chatrooms/${chatId}/messages`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: testContent }),
    });
    
    if (!postRes.ok) {
      const error = await postRes.json();
      console.error(`  ❌ 發送訊息失敗: ${postRes.status}`, error);
      return false;
    }
    
    const messageData = await postRes.json();
    console.log(`  ✅ 訊息已發送:`, messageData);
    
    // 3. 等待一下讓 DB 更新
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 4. 檢查 meta 是否更新
    const updatedRes = await fetch(`${API_URL}/api/chatrooms/${chatId}/meta`, { headers });
    const updatedMeta = await updatedRes.json();
    console.log(`  更新後 meta:`, updatedMeta);
    
    // 5. 驗證
    const messageCountIncreased = updatedMeta.messageCount > initialMeta.messageCount;
    const lastMessageAtUpdated = updatedMeta.lastMessageAt !== initialMeta.lastMessageAt;
    
    if (messageCountIncreased && lastMessageAtUpdated) {
      console.log(`  ✅ Meta 已正確更新`);
      return true;
    } else {
      console.error(`  ❌ Meta 未正確更新`);
      console.error(`    messageCount 增加: ${messageCountIncreased}`);
      console.error(`    lastMessageAt 更新: ${lastMessageAtUpdated}`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ 測試失敗:`, error.message);
    return false;
  }
}

async function testForbiddenContent() {
  console.log('\n🧪 測試 3: 禁止內容過濾');
  console.log('─'.repeat(50));
  
  if (!sessionToken) {
    console.log('  ⚠️  需要 session token 才能測試');
    return true;
  }
  
  const forbiddenTests = [
    { content: 'https://example.com', shouldBlock: true },
    { content: 'contact@example.com', shouldBlock: true },
    { content: '@username', shouldBlock: true },
    { content: '我的 line id 是...', shouldBlock: true },
    { content: '正常訊息內容', shouldBlock: false },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of forbiddenTests) {
    try {
      const res = await fetch(`${API_URL}/api/chatrooms/${chatId}/messages`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: test.content }),
      });
      
      const isBlocked = !res.ok;
      
      if (isBlocked === test.shouldBlock) {
        console.log(`  ✅ "${test.content}" - ${test.shouldBlock ? '正確阻擋' : '正確允許'}`);
        passed++;
      } else {
        console.log(`  ❌ "${test.content}" - 應該${test.shouldBlock ? '阻擋' : '允許'}但${isBlocked ? '被阻擋' : '被允許'}`);
        failed++;
      }
    } catch (error) {
      console.error(`  ❌ 測試 "${test.content}" 時發生錯誤:`, error.message);
      failed++;
    }
  }
  
  console.log(`\n  📊 結果: ${passed} 通過, ${failed} 失敗`);
  return failed === 0;
}

async function runAllTests() {
  console.log('🚀 開始預聊系統效能測試');
  console.log('═'.repeat(50));
  console.log(`Chat ID: ${chatId}`);
  console.log(`API URL: ${API_URL}`);
  console.log(`Session Token: ${sessionToken ? '已提供' : '未提供（部分測試將跳過）'}`);
  
  const results = {
    meta: await testMetaEndpoint(),
    messageUpdate: await testMessageUpdate(),
    forbiddenContent: await testForbiddenContent(),
  };
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 測試總結');
  console.log('─'.repeat(50));
  console.log(`Meta Endpoint: ${results.meta ? '✅ 通過' : '❌ 失敗'}`);
  console.log(`訊息更新: ${results.messageUpdate ? '✅ 通過' : '❌ 失敗'}`);
  console.log(`內容過濾: ${results.forbiddenContent ? '✅ 通過' : '❌ 失敗'}`);
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('\n🎉 所有測試通過！');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分測試失敗，請檢查上述錯誤訊息');
    process.exit(1);
  }
}

// 執行測試
runAllTests().catch(error => {
  console.error('❌ 測試執行失敗:', error);
  process.exit(1);
});

