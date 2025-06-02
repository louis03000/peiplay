import { NextAuthOptions } from 'next-auth'
import { prisma } from './prisma'
import { UserRole } from '@prisma/client'
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import LineProvider from 'next-auth/providers/line'

declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    role: UserRole
    lineId?: string | null
    twoFactorSecret?: string | null
    isTwoFactorEnabled?: boolean
  }

  interface Session {
    user: User
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
      authorization: {
        params: { scope: 'openid profile email' },
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'line') {
        const existUser = await prisma.user.findUnique({ where: { email: user.email! } })
        if (!existUser) {
          const newUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              role: 'CUSTOMER' as UserRole,
              password: '',
            },
          })
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
          await prisma.customer.updateMany({
            where: { userId: existUser.id, lineId: null },
            data: { lineId: profile?.sub || null },
          })
        }
      }
      return true
    },
  },
  pages: {
    signIn: '/auth/login',
    newUser: '/profile',
    error: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: true,
} 