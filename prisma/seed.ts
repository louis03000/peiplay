import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'louis92427@gmail.com';
  const password = 'sss920427';
  const hashedPassword = await bcrypt.hash(password, 10);

  const exist = await prisma.user.findUnique({ where: { email } });
  if (exist) {
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    console.log('已將現有帳號設為管理員');
  } else {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: '管理員',
        role: 'ADMIN',
      },
    });
    console.log('已建立管理員帳號');
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect()); 