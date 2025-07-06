import { AuthOptions } from 'next-auth'
import LineProvider from 'next-auth/providers/line'
import { prisma } from '@/app/lib/prisma'
import type { UserRole } from '@prisma/client'

export const authOptions: AuthOptions = {
  providers: [
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        // 查詢完整 user 資料
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub as string },
          select: { name: true, phone: true, birthday: true, discord: true, role: true, email: true }
        });
        if (dbUser) {
          session.user.name = dbUser.name;
          session.user.phone = dbUser.phone;
          session.user.birthday = dbUser.birthday ? dbUser.birthday.toISOString().slice(0, 10) : null;
          session.user.discord = dbUser.discord;
          session.user.role = dbUser.role;
          session.user.email = dbUser.email;
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token
        token.sub = user.id
        token.role = user.role
      }
      if (token?.sub && !user) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub as string }, select: { role: true } })
        if (dbUser && typeof dbUser.role === 'string') token.role = dbUser.role
      }
      return token
    }
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error'
  }
} 