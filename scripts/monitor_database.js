#!/usr/bin/env node
/**
 * 資料庫監控腳本
 * 每小時檢查一次資料庫狀態
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function monitorDatabase() {
  try {
    console.log(`🔍 [${new Date().toLocaleString()}] 開始資料庫監控...`);
    
    // 檢查連接
    await prisma.$connect();
    
    // 檢查各表格記錄數量
    const counts = {
      users: await prisma.user.count(),
      partners: await prisma.partner.count(),
      customers: await prisma.customer.count(),
      bookings: await prisma.booking.count(),
      schedules: await prisma.schedule.count(),
      reviews: await prisma.review.count(),
      orders: await prisma.order.count(),
    };
    
    // 記錄到日誌文件
    const logEntry = {
      timestamp: new Date().toISOString(),
      counts: counts,
      status: 'healthy'
    };
    
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, `monitor_${new Date().toISOString().split('T')[0]}.json`);
    
    let logs = [];
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    
    console.log('📊 資料統計:', counts);
    
    // 檢查是否有異常
    if (counts.users === 0 && counts.partners === 0 && counts.customers === 0) {
      console.log('⚠️ 警告: 所有用戶數據為空！');
      // 可以發送通知或觸發備份
    }
    
    // 檢查最近的活動
    const recentBookings = await prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, status: true }
    });
    
    if (recentBookings.length > 0) {
      console.log('📅 最近的預約記錄:');
      recentBookings.forEach(booking => {
        console.log(`   ${booking.id}: ${booking.createdAt} (${booking.status})`);
      });
    }
    
    console.log('✅ 監控完成');
    
  } catch (error) {
    console.error('❌ 監控失敗:', error);
    
    // 記錄錯誤
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      status: 'error'
    };
    
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const errorLogFile = path.join(logDir, `error_${new Date().toISOString().split('T')[0]}.json`);
    
    let errorLogs = [];
    if (fs.existsSync(errorLogFile)) {
      errorLogs = JSON.parse(fs.readFileSync(errorLogFile, 'utf8'));
    }
    
    errorLogs.push(errorLog);
    fs.writeFileSync(errorLogFile, JSON.stringify(errorLogs, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  monitorDatabase();
}

module.exports = { monitorDatabase };
