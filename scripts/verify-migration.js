/**
 * 驗證 Migration 性能和索引
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('🔍 驗證 Migration 性能...\n');

    // 1. 檢查字段
    console.log('1️⃣ 檢查字段是否存在：');
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'ChatMessage' 
      AND column_name IN ('senderName', 'senderAvatarUrl');
    `);
    console.table(columns);

    // 2. 檢查索引
    console.log('\n2️⃣ 檢查索引是否存在：');
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT 
        indexname, 
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'ChatMessage' 
      AND indexname = 'ChatMessage_roomId_createdAt_idx';
    `);
    
    if (indexes && indexes.length > 0) {
      console.log(`   ✅ 索引存在: ${indexes[0].indexname}`);
      console.log(`   📋 定義: ${indexes[0].indexdef.substring(0, 100)}...`);
    } else {
      console.log('   ❌ 索引未找到');
    }

    // 3. 測試查詢性能（使用一個真實的 roomId，如果有的話）
    console.log('\n3️⃣ 測試查詢性能：');
    
    // 先找一個存在的 roomId
    const sampleRoom = await prisma.$queryRawUnsafe(`
      SELECT "roomId" FROM "ChatMessage" LIMIT 1;
    `);
    
    if (sampleRoom && sampleRoom.length > 0) {
      const roomId = sampleRoom[0].roomId;
      console.log(`   使用 roomId: ${roomId}`);
      
      const explainResult = await prisma.$queryRawUnsafe(`
        EXPLAIN ANALYZE
        SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
        FROM "ChatMessage"
        WHERE "roomId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 30;
      `, roomId);
      
      console.log('\n   📊 查詢計劃：');
      const plan = explainResult.map((r) => r['QUERY PLAN']).join('\n');
      console.log(plan);
      
      // 檢查是否使用索引
      if (plan.includes('Index Scan') && plan.includes('ChatMessage_roomId_createdAt_idx')) {
        console.log('\n   ✅ 成功使用索引！');
        
        // 提取執行時間
        const timeMatch = plan.match(/Execution Time: ([\d.]+) ms/);
        if (timeMatch) {
          const time = parseFloat(timeMatch[1]);
          if (time < 100) {
            console.log(`   ✅ 執行時間: ${time} ms (優秀！)`);
          } else if (time < 300) {
            console.log(`   ⚠️  執行時間: ${time} ms (可接受)`);
          } else {
            console.log(`   ❌ 執行時間: ${time} ms (需要優化)`);
          }
        }
      } else {
        console.log('\n   ⚠️  未使用索引，可能需要檢查');
      }
    } else {
      console.log('   ℹ️  沒有找到測試資料，跳過性能測試');
    }

    // 4. 統計資料
    console.log('\n4️⃣ 資料統計：');
    const stats = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT("senderName") as messages_with_name,
        COUNT("senderAvatarUrl") as messages_with_avatar
      FROM "ChatMessage";
    `);
    console.table(stats);

    console.log('\n✅ 驗證完成！');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ 驗證失敗：', error.message);
    if (prisma) {
      await prisma.$disconnect();
    }
    process.exit(1);
  }
}

verifyMigration();

