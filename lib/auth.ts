import { NextAuthOptions } from 'next-auth'
import { prisma } from './prisma'
import { UserRole } from '@prisma/client'
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import LineProvider from 'next-auth/providers/line'

// 型別擴充
import 'next-auth';
declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    role: UserRole
    phone?: string | null
    birthday?: string | null
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
      authorization: { params: { scope: 'openid profile email' } },
      profile(profile) {
        const lineId = (profile as any).id || (profile as any).userId;
        return {
          id: lineId,
          name: profile.displayName,
          email: profile.email ?? `${lineId}@line.local`,
          image: profile.pictureUrl,
          phone: null,
          birthday: null,
          role: 'CUSTOMER' as UserRole,
        }
      }
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
          phone: user.phone ?? null,
          birthday: user.birthday ? user.birthday.toISOString().slice(0, 10) : null,
        };
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('signIn callback', { user, account, profile });
      if (account?.provider === 'line') {
        const lineId = (profile as any)?.id || (profile as any)?.userId;
        let email = user.email ?? `${lineId}@line.local`;
        let existUser = await prisma.user.findUnique({ where: { email } });
        if (!existUser) {
          existUser = await prisma.user.create({
            data: {
              email,
              name: user.name || '',
              role: 'CUSTOMER' as UserRole,
              password: '',
            },
          });
        }
        user.id = existUser.id;
        user.email = existUser.email;
        user.phone = existUser.phone ?? null;
        user.birthday = existUser.birthday ? existUser.birthday.toISOString().slice(0, 10) : null;
        user.role = existUser.role;
      }
      return true;
    },
    async session({ session, token }) {
      console.log('session callback', { session, token });
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as UserRole;
        session.user.phone = token.phone as string | null;
        session.user.birthday = token.birthday as string | null;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      console.log('jwt callback', { token, user, account });
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.phone = user.phone ?? null;
        token.birthday = user.birthday ?? null;
      }
      return token;
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