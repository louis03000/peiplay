#!/usr/bin/env node
/**
 * 資料庫狀態檢查腳本
 * 監控資料庫連接和資料完整性
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabaseStatus() {
  try {
    console.log('🔍 檢查資料庫狀態...');
    
    // 檢查連接
    await prisma.$connect();
    console.log('✅ 資料庫連接正常');
    
    // 檢查各表格的記錄數量
    const counts = {
      users: await prisma.user.count(),
      partners: await prisma.partner.count(),
      customers: await prisma.customer.count(),
      bookings: await prisma.booking.count(),
      schedules: await prisma.schedule.count(),
      reviews: await prisma.review.count(),
      orders: await prisma.order.count(),
    };
    
    console.log('📊 資料統計:');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`   ${table}: ${count} 筆記錄`);
    });
    
    // 檢查最近的資料
    const recentBookings = await prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, status: true }
    });
    
    console.log('📅 最近的預約記錄:');
    recentBookings.forEach(booking => {
      console.log(`   ${booking.id}: ${booking.createdAt} (${booking.status})`);
    });
    
    // 檢查資料庫大小（如果支援）
    try {
      const result = await prisma.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size;
      `;
      console.log(`💾 資料庫大小: ${result[0].size}`);
    } catch (e) {
      console.log('⚠️ 無法獲取資料庫大小資訊');
    }
    
  } catch (error) {
    console.error('❌ 資料庫檢查失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  checkDatabaseStatus();
}

module.exports = { checkDatabaseStatus };
