#!/usr/bin/env node
/**
 * 資料庫備份腳本
 * 每週自動備份重要資料
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  try {
    console.log('🔄 開始資料庫備份...');
    
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
    
    console.log(`✅ 備份完成: ${filepath}`);
    
    // 清理舊備份（保留最近30天）
    const files = fs.readdirSync(backupDir);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    files.forEach(file => {
      if (file.startsWith('backup_') && file.endsWith('.json')) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtime < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ 刪除舊備份: ${file}`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ 備份失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  backupDatabase();
}

module.exports = { backupDatabase };
