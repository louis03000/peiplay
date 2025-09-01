const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixBookingStatus() {
  try {
    console.log('🔧 修復預約狀態...');
    
    // 找到待付款的預約
    const pendingBookings = await prisma.booking.findMany({
      where: {
        status: 'PENDING_PAYMENT'
      },
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
    
    console.log(`📊 找到 ${pendingBookings.length} 個待付款預約`);
    
    for (const booking of pendingBookings) {
      console.log(`\n🔍 處理預約: ${booking.id}`);
      console.log(`   顧客: ${booking.customer.user.email}`);
      console.log(`   夥伴: ${booking.schedule.partner.user.email}`);
      console.log(`   訂單編號: ${booking.orderNumber}`);
      
      // 檢查是否有訂單編號（表示已付款）
      if (booking.orderNumber) {
        console.log('✅ 有訂單編號，更新為已確認狀態');
        
        // 更新為已確認狀態
        const updatedBooking = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CONFIRMED',
            paymentInfo: {
              orderNumber: booking.orderNumber,
              paymentDate: new Date().toISOString(),
              paymentType: '信用卡',
              amount: booking.finalAmount,
              expectedAmount: booking.finalAmount,
              amountMismatch: false,
              paymentNote: '手動修復付款狀態'
            }
          }
        });
        
        console.log(`✅ 預約狀態已更新為: ${updatedBooking.status}`);
      } else {
        console.log('⚠️ 沒有訂單編號，保持待付款狀態');
      }
    }
    
    console.log('\n🎉 預約狀態修復完成！');
    
  } catch (error) {
    console.error('❌ 修復預約狀態時發生錯誤:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBookingStatus();
