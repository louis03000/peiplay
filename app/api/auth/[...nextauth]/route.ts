import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const handler = NextAuth({
  ...authOptions,
  callbacks: {
    ...authOptions.callbacks,
    async signIn({ user, account, profile }) {
      // LINE 登入自動建立 user/customer
      if (account?.provider === 'line') {
        // 檢查 user 是否已存在
        const existUser = await prisma.user.findUnique({ where: { email: user.email! } })
        if (!existUser) {
          // 建立 user
          const newUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              role: 'CUSTOMER',
              password: '',
            },
          })
          // 建立 customer
          await prisma.customer.create({
            data: {
              userId: newUser.id,
              name: user.name || '',
              phone: '',
              birthday: new Date('2000-01-01'),
              lineId: profile?.sub || null,
            },
          })
        } else {
          // 若已存在，補寫 lineId
          await prisma.customer.updateMany({
            where: { userId: existUser.id, lineId: null },
            data: { lineId: profile?.sub || null },
          })
        }
      }
      return true
    },
  },
})

export { handler as GET, handler as POST } 