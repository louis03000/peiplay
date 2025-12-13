#!/usr/bin/env node
/**
 * PostgreSQL 資料庫備份腳本 (Node.js 版本)
 * 
 * 使用 pg_dump 進行完整備份
 * 適用於無法使用 shell 腳本的環境（如 Windows）
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || '7', 10);

if (!DATABASE_URL) {
  console.error('❌ 錯誤: DATABASE_URL 環境變數未設置');
  process.exit(1);
}

// 創建備份目錄
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 生成備份檔名
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.sql.gz`);

console.log('🔄 開始備份資料庫...');
console.log(`   備份檔: ${backupFile}`);

try {
  // 執行 pg_dump
  const command = `pg_dump "${DATABASE_URL}" | gzip > "${backupFile}"`;
  execSync(command, { stdio: 'inherit' });

  // 檢查備份是否成功
  if (fs.existsSync(backupFile)) {
    const stats = fs.statSync(backupFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`✅ 備份完成: ${backupFile} (${sizeMB} MB)`);
  } else {
    throw new Error('備份檔案未生成');
  }

  // 清理舊備份
  console.log(`🧹 清理 ${RETENTION_DAYS} 天前的舊備份...`);
  const files = fs.readdirSync(BACKUP_DIR);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  let deletedCount = 0;
  files.forEach((file) => {
    if (file.startsWith('backup_') && file.endsWith('.sql.gz')) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`   🗑️  刪除: ${file}`);
      }
    }
  });

  console.log(`✅ 清理完成 (刪除 ${deletedCount} 個舊備份)`);

  // 列出當前備份
  console.log('\n📦 當前備份列表:');
  const backupFiles = files
    .filter((f) => f.startsWith('backup_') && f.endsWith('.sql.gz'))
    .map((f) => {
      const filePath = path.join(BACKUP_DIR, f);
      const stats = fs.statSync(filePath);
      return {
        name: f,
        size: stats.size,
        date: stats.mtime,
      };
    })
    .sort((a, b) => b.date - a.date)
    .slice(0, 5);

  backupFiles.forEach((file) => {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    console.log(`   ${file.name} (${sizeMB} MB, ${file.date.toLocaleDateString()})`);
  });

  console.log('\n✅ 備份流程完成');
} catch (error) {
  console.error('❌ 備份失敗:', error.message);
  process.exit(1);
}

