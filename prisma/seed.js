const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // 建立管理員帳號
  const adminEmail = 'peiplay2025@gmail.com';
  const adminPassword = 'peiplay2025sss920427';
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

  const adminExist = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (adminExist) {
    await prisma.user.update({ 
      where: { email: adminEmail }, 
      data: { role: 'ADMIN', password: hashedAdminPassword } 
    });
    console.log('已將現有帳號設為管理員並重設密碼');
  } else {
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedAdminPassword,
        name: '管理員',
        role: 'ADMIN',
      },
    });
    console.log('已建立管理員帳號');
  }

  // 建立測試夥伴帳號
  const partnerEmail = 'partner@example.com';
  const partnerPassword = 'partner123';
  const hashedPartnerPassword = await bcrypt.hash(partnerPassword, 10);

  let partnerUser = await prisma.user.findUnique({ where: { email: partnerEmail } });
  if (!partnerUser) {
    partnerUser = await prisma.user.create({
      data: {
        email: partnerEmail,
        password: hashedPartnerPassword,
        name: '測試夥伴',
        role: 'PARTNER',
      },
    });
    console.log('已建立測試夥伴帳號');
  }

  // 建立夥伴資料
  let partner = await prisma.partner.findUnique({ where: { userId: partnerUser.id } });
  if (!partner) {
    partner = await prisma.partner.create({
      data: {
        name: '測試夥伴',
        birthday: new Date('1995-01-01'),
        phone: '0912345678',
        coverImage: 'https://via.placeholder.com/400x300',
        games: ['英雄聯盟', '傳說對決', '原神'],
        halfHourlyRate: 500,
        userId: partnerUser.id,
        status: 'APPROVED',
        isAvailableNow: true,
      },
    });
    console.log('已建立夥伴資料');
  }

  // 建立測試客戶帳號
  const customerEmail = 'customer@example.com';
  const customerPassword = 'customer123';
  const hashedCustomerPassword = await bcrypt.hash(customerPassword, 10);

  let customerUser = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (!customerUser) {
    customerUser = await prisma.user.create({
      data: {
        email: customerEmail,
        password: hashedCustomerPassword,
        name: '測試客戶',
        role: 'CUSTOMER',
      },
    });
    console.log('已建立測試客戶帳號');
  }

  // 建立客戶資料
  let customer = await prisma.customer.findUnique({ where: { userId: customerUser.id } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: '測試客戶',
        birthday: new Date('1990-01-01'),
        phone: '0987654321',
        userId: customerUser.id,
      },
    });
    console.log('已建立客戶資料');
  }

  // 建立一些測試時程
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 明天的時程
  for (let hour = 9; hour <= 18; hour += 2) {
    const startTime = new Date(tomorrow);
    startTime.setHours(hour, 0, 0, 0);
    const endTime = new Date(tomorrow);
    endTime.setHours(hour + 2, 0, 0, 0);

    await prisma.schedule.create({
      data: {
        partnerId: partner.id,
        date: tomorrow,
        startTime,
        endTime,
        isAvailable: true,
      },
    });
  }

  // 後天的時程
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  for (let hour = 10; hour <= 20; hour += 2) {
    const startTime = new Date(dayAfterTomorrow);
    startTime.setHours(hour, 0, 0, 0);
    const endTime = new Date(dayAfterTomorrow);
    endTime.setHours(hour + 2, 0, 0, 0);

    await prisma.schedule.create({
      data: {
        partnerId: partner.id,
        date: dayAfterTomorrow,
        startTime,
        endTime,
        isAvailable: true,
      },
    });
  }

  console.log('已建立測試時程');

  // 建立一些測試預約
  const schedules = await prisma.schedule.findMany({
    where: { partnerId: partner.id },
    take: 3,
  });

  for (const schedule of schedules) {
    await prisma.booking.create({
      data: {
        customerId: customer.id,
        scheduleId: schedule.id,
        status: 'PENDING',
        orderNumber: `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        originalAmount: 1000, // 2小時 * 500元/半小時
        finalAmount: 1000, // 最終金額（無折扣）
      },
    });
  }

  console.log('已建立測試預約');

  console.log('✅ 所有測試資料建立完成！');
  console.log('📧 管理員帳號:', adminEmail, '密碼:', adminPassword);
  console.log('📧 夥伴帳號:', partnerEmail, '密碼:', partnerPassword);
  console.log('📧 客戶帳號:', customerEmail, '密碼:', customerPassword);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
