import { NextAuthOptions } from 'next-auth'
import { prisma } from './prisma'
import { UserRole } from '@prisma/client'
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

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

const LineProvider = (options = {}) => ({
  id: 'line',
  name: 'LINE',
  type: 'oauth' as const,
  wellKnown: 'https://access.line.me/.well-known/openid-configuration',
  authorization: {
    url: 'https://access.line.me/oauth2/v2.1/authorize',
    params: { scope: 'openid profile email' },
  },
  token: 'https://api.line.me/oauth2/v2.1/token',
  userinfo: 'https://api.line.me/v2/profile',
  clientId: process.env.LINE_CLIENT_ID,
  clientSecret: process.env.LINE_CLIENT_SECRET,
  profile(profile: unknown) {
    const p = profile as { userId?: string; sub?: string; displayName?: string; email?: string; pictureUrl?: string }
    return {
      id: String(p.userId || p.sub || ''),
      name: String(p.displayName || ''),
      email: p.email || `${p.userId || p.sub || 'unknown'}@line.user`,
      image: String(p.pictureUrl || ''),
      role: 'CUSTOMER' as UserRole,
      lineId: String(p.userId || p.sub || ''),
      isTwoFactorEnabled: false
    }
  },
  ...options,
})

export const authOptions: NextAuthOptions = {
  providers: [
    LineProvider(),
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.image = user.image
        token.role = user.role
        token.lineId = user.lineId
        token.isTwoFactorEnabled = user.isTwoFactorEnabled
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.image as string
        session.user.role = token.role as UserRole
        session.user.lineId = token.lineId as string
        session.user.isTwoFactorEnabled = token.isTwoFactorEnabled as boolean
      }
      return session
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
} 