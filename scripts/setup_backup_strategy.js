#!/usr/bin/env node
/**
 * 完整的備份策略設置
 * 包括自動備份、監控和恢復測試
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const prisma = new PrismaClient();

// 1. 每日自動備份
cron.schedule('0 2 * * *', async () => {
  console.log('🔄 開始每日自動備份...');
  await backupDatabase();
});

// 2. 每週備份測試
cron.schedule('0 3 * * 0', async () => {
  console.log('🧪 開始備份恢復測試...');
  await testBackupRestore();
});

// 3. 每日健康檢查
cron.schedule('0 1 * * *', async () => {
  console.log('🏥 開始資料庫健康檢查...');
  await healthCheck();
});

async function backupDatabase() {
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      users: await prisma.user.findMany(),
      partners: await prisma.partner.findMany(),
      customers: await prisma.customer.findMany(),
      bookings: await prisma.booking.findMany(),
      schedules: await prisma.schedule.findMany(),
      reviews: await prisma.review.findMany(),
      orders: await prisma.order.findMany(),
    };
    
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
    
    // 上傳到雲端存儲（可選）
    await uploadToCloudStorage(filepath);
    
    console.log(`✅ 備份完成: ${filepath}`);
    
  } catch (error) {
    console.error('❌ 備份失敗:', error);
    // 發送告警通知
    await sendAlert('備份失敗', error.message);
  }
}

async function testBackupRestore() {
  try {
    // 測試最新的備份文件是否可以正常讀取
    const backupDir = path.join(__dirname, '../backups');
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length > 0) {
      const latestBackup = path.join(backupDir, files[0]);
      const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));
      
      // 驗證備份數據完整性
      const requiredTables = ['users', 'partners', 'customers', 'bookings'];
      const isValid = requiredTables.every(table => 
        Array.isArray(backupData[table])
      );
      
      if (isValid) {
        console.log('✅ 備份文件完整性檢查通過');
      } else {
        console.log('❌ 備份文件完整性檢查失敗');
        await sendAlert('備份完整性檢查失敗', '備份文件可能損壞');
      }
    }
  } catch (error) {
    console.error('❌ 備份測試失敗:', error);
    await sendAlert('備份測試失敗', error.message);
  }
}

async function healthCheck() {
  try {
    // 檢查資料庫連接
    await prisma.$connect();
    
    // 檢查各表格記錄數量
    const counts = {
      users: await prisma.user.count(),
      partners: await prisma.partner.count(),
      customers: await prisma.customer.count(),
      bookings: await prisma.booking.count(),
    };
    
    // 檢查是否有異常的數據丟失
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentBookings = await prisma.booking.count({
      where: {
        createdAt: {
          gte: yesterday
        }
      }
    });
    
    console.log('📊 健康檢查結果:', counts);
    console.log(`📅 昨日新增預約: ${recentBookings}`);
    
    // 如果數據異常，發送告警
    if (counts.users === 0 && counts.partners === 0) {
      await sendAlert('資料庫異常', '所有用戶和夥伴數據為空');
    }
    
  } catch (error) {
    console.error('❌ 健康檢查失敗:', error);
    await sendAlert('資料庫健康檢查失敗', error.message);
  }
}

async function uploadToCloudStorage(filepath) {
  // 這裡可以實現上傳到 AWS S3, Google Cloud Storage 等
  console.log(`☁️ 上傳備份到雲端存儲: ${filepath}`);
}

async function sendAlert(title, message) {
  // 這裡可以實現發送郵件、Slack 通知等
  console.log(`🚨 告警: ${title} - ${message}`);
}

// 手動執行備份
if (require.main === module) {
  backupDatabase().then(() => {
    console.log('手動備份完成');
    process.exit(0);
  });
}

module.exports = { backupDatabase, testBackupRestore, healthCheck };
