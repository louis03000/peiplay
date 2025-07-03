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
        session.user.id = token.sub as string
        if (typeof token.role === 'string' && ['CUSTOMER', 'PARTNER', 'ADMIN'].includes(token.role)) {
          session.user.role = token.role as UserRole
        }
      }
      return session
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