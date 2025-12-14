/**
 * 執行 ChatMessage denormalized fields migration
 * 
 * 使用方法：
 * node scripts/run-migration.js
 * 
 * 或指定資料庫 URL：
 * DATABASE_URL=postgresql://user:pass@host:5432/db node scripts/run-migration.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 使用 Prisma Client 執行 SQL
let prisma;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (error) {
  console.error('❌ 無法載入 Prisma Client，請先執行: npx prisma generate');
  process.exit(1);
}

// 嘗試從 .env 文件讀取 DATABASE_URL
let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^DATABASE_URL=(.+)$/m);
      if (match) {
        DATABASE_URL = match[1].trim();
        console.log('✅ 從 .env 文件讀取 DATABASE_URL');
      }
    }
  } catch (error) {
    // 忽略錯誤
  }
}

if (!DATABASE_URL) {
  console.error('❌ 錯誤：請設定 DATABASE_URL 環境變數');
  console.log('範例：DATABASE_URL=postgresql://user:pass@host:5432/db node scripts/run-migration.js');
  process.exit(1);
}

console.log('🚀 開始執行 migration...');
console.log(`📊 資料庫：${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

// Migration SQL
const migrationSQL = `
-- Step 1: 添加 denormalized 字段
ALTER TABLE "ChatMessage"
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;

-- Step 2: 建立複合索引（CONCURRENTLY 不鎖表）
-- 注意：CONCURRENTLY 必須在 transaction 外執行
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);
`;

async function runMigration() {
  try {
    // 執行 Step 1（添加字段）
    console.log('\n📝 Step 1: 添加字段...');
    const addColumnsSQL = `
      ALTER TABLE "ChatMessage"
      ADD COLUMN IF NOT EXISTS "senderName" TEXT,
      ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;
    `;
    
    await prisma.$executeRawUnsafe(addColumnsSQL);
    console.log('✅ 字段添加完成');

    // 執行 Step 2（建立索引）
    console.log('\n📝 Step 2: 建立索引（CONCURRENTLY）...');
    console.log('⚠️  這可能需要一些時間，請耐心等待...');
    
    // 注意：CONCURRENTLY 必須在 transaction 外執行
    // Prisma 的 $executeRawUnsafe 預設不在 transaction 中，所以可以直接執行
    const createIndexSQL = `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
      ON "ChatMessage"("roomId", "createdAt" DESC);
    `;
    
    await prisma.$executeRawUnsafe(createIndexSQL);
    console.log('✅ 索引建立完成');

    // 驗證
    console.log('\n🔍 驗證 migration...');
    
    const verifyColumns = await prisma.$queryRawUnsafe(`
      SELECT 
        column_name, 
        data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ChatMessage' 
      AND column_name IN ('senderName', 'senderAvatarUrl');
    `);
    
    console.log('✅ 字段驗證結果：');
    console.table(verifyColumns);

    const verifyIndex = await prisma.$queryRawUnsafe(`
      SELECT 
        indexname, 
        indexdef 
      FROM pg_indexes 
      WHERE tablename = 'ChatMessage' 
      AND indexname = 'ChatMessage_roomId_createdAt_idx';
    `);
    
    console.log('✅ 索引驗證結果：');
    if (verifyIndex && verifyIndex.length > 0) {
      console.log(`   索引名稱: ${verifyIndex[0].indexname}`);
    } else {
      console.log('   ⚠️  索引未找到，可能需要等待索引建立完成');
    }

    console.log('\n✅ Migration 完成！');
    console.log('\n📋 下一步：');
    console.log('1. 執行驗證 SQL 確認索引性能');
    console.log('2. 執行 backfill 腳本更新舊資料（可選）');
    console.log('3. 測試聊天室功能');

    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ Migration 失敗：', error.message);
    console.log('\n💡 提示：');
    console.log('1. 確認 DATABASE_URL 正確');
    console.log('2. 確認有資料庫權限');
    console.log('3. 如果字段/索引已存在，這是正常的（IF NOT EXISTS）');
    console.log('4. CONCURRENTLY 可能需要一些時間，請耐心等待');
    
    if (prisma) {
      await prisma.$disconnect();
    }
    process.exit(1);
  }
}

runMigration();

