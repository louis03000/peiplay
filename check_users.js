const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 檢查資料庫中的用戶...');
    
    // 檢查用戶總數
    const userCount = await prisma.user.count();
    console.log(`📊 用戶總數: ${userCount}`);
    
    if (userCount === 0) {
      console.log('❌ 資料庫中沒有用戶數據！');
      return;
    }
    
    // 列出所有用戶
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        discord: true
      }
    });
    
    console.log('\n👥 用戶列表:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name || '無名稱'}) - ${user.role} - Discord: ${user.discord || '無'}`);
    });
    
    // 檢查管理員帳號
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' }
    });
    
    console.log(`\n👑 管理員帳號數量: ${adminUsers.length}`);
    adminUsers.forEach(admin => {
      console.log(`- ${admin.email} (${admin.name || '無名稱'})`);
    });
    
  } catch (error) {
    console.error('❌ 檢查用戶時發生錯誤:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
