const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkBookingStatus() {
  try {
    console.log('🔍 檢查預約狀態...');
    
    // 檢查所有預約
    const bookings = await prisma.booking.findMany({
      include: {
        customer: {
          include: {
            user: true
          }
        },
        schedule: {
          include: {
            partner: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });
    
    console.log(`📊 預約總數: ${bookings.length}`);
    
    if (bookings.length === 0) {
      console.log('❌ 沒有找到任何預約');
      return;
    }
    
    console.log('\n📋 預約列表:');
    bookings.forEach((booking, index) => {
      console.log(`${index + 1}. 預約ID: ${booking.id}`);
      console.log(`   顧客: ${booking.customer.user.email} (${booking.customer.user.discord || '無Discord'})`);
      console.log(`   夥伴: ${booking.schedule.partner.user.email} (${booking.schedule.partner.user.discord || '無Discord'})`);
      console.log(`   狀態: ${booking.status}`);
      console.log(`   訂單編號: ${booking.orderNumber || '無'}`);
      console.log(`   付款資訊: ${JSON.stringify(booking.paymentInfo) || '無'}`);
      console.log(`   建立時間: ${booking.createdAt}`);
      console.log(`   更新時間: ${booking.updatedAt}`);
      console.log('   ---');
    });
    
    // 檢查特定用戶的預約
    const louis030Bookings = bookings.filter(b => 
      b.customer.user.email === 'asd456@gmail.com' || 
      b.schedule.partner.user.email === 'asd456@gmail.com'
    );
    
    if (louis030Bookings.length > 0) {
      console.log('\n🎯 louis030 相關預約:');
      louis030Bookings.forEach(booking => {
        console.log(`預約ID: ${booking.id}, 狀態: ${booking.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 檢查預約狀態時發生錯誤:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBookingStatus();
