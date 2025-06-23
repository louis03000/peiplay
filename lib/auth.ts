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
    provider: string
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
          provider: 'credentials',
        };
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as UserRole;
        session.user.provider = token.provider as string;
      }
      return session;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.role = user.role;
      }
      if (account && user) {
        token.accessToken = account.access_token;
        token.sub = user.id;
        token.provider = account.provider;
        if (account.provider === 'line') {
          const lineId = profile?.sub || null;
          const email = user.email || (lineId ? `${lineId}@line.local` : `${user.id}@line.local`);
          let existingUser = await prisma.user.findUnique({ where: { email } });
          if (!existingUser) {
            existingUser = await prisma.user.create({
              data: {
                email,
                name: user.name || '',
                password: '',
                role: 'CUSTOMER',
              },
            });
          }
          token.sub = existingUser.id;
        }
      }
      return token;
    },
    async signIn({ user, account, profile }) {
      if (!user?.id) return false;

      // 查一次 customer
      let existCustomer = await prisma.customer.findUnique({ where: { userId: user.id } });

      // 沒有才建立
      if (!existCustomer) {
        await prisma.customer.create({
          data: {
            userId: user.id,
            name: user.name || 'New User',
            phone: '',
            birthday: new Date('2000-01-01'),
            lineId: account?.provider === 'line' ? profile?.sub : null,
          },
        });
      } else if (account?.provider === 'line' && !existCustomer.lineId && profile?.sub) {
        // 如果是 line 登入且已存在但沒 lineId，則補上
        await prisma.customer.update({
          where: { userId: user.id },
          data: { lineId: profile.sub }
        });
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/login',
    newUser: '/onboarding',
    error: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: true,
} 