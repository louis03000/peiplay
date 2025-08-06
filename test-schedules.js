const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSchedules() {
  try {
    console.log('檢查夥伴資料...');
    const partners = await prisma.partner.findMany({
      where: { status: 'APPROVED' },
      include: {
        schedules: {
          where: {
            date: {
              gte: new Date('2025-08-06T00:00:00.000Z'),
              lt: new Date('2025-09-05T00:00:00.000Z'),
            }
          },
          include: {
            bookings: true
          }
        }
      }
    });

    console.log(`找到 ${partners.length} 個已核准的夥伴`);
    
    partners.forEach(partner => {
      console.log(`\n夥伴: ${partner.name}`);
      console.log(`時段數量: ${partner.schedules.length}`);
      
      partner.schedules.forEach(schedule => {
        console.log(`  - 日期: ${schedule.date.toISOString()}`);
        console.log(`    開始時間: ${schedule.startTime.toISOString()}`);
        console.log(`    結束時間: ${schedule.endTime.toISOString()}`);
        console.log(`    可用: ${schedule.isAvailable}`);
        console.log(`    預約: ${schedule.bookings ? schedule.bookings.status : '無'}`);
      });
    });

  } catch (error) {
    console.error('錯誤:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSchedules(); 