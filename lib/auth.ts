import { NextAuthOptions } from 'next-auth'
import { prisma } from './prisma'

const LineProvider = (options = {}) => ({
  id: 'line',
  name: 'LINE',
  type: 'oauth' as const,
  version: '2.0',
  wellKnown: 'https://access.line.me/.well-known/openid-configuration',
  authorization: {
    url: 'https://access.line.me/oauth2/v2.1/authorize',
    params: { scope: 'openid profile email' },
  },
  token: 'https://api.line.me/oauth2/v2.1/token',
  userinfo: 'https://api.line.me/v2/profile',
  clientId: process.env.LINE_CLIENT_ID,
  clientSecret: process.env.LINE_CLIENT_SECRET,
  profile(profile: any) {
    return {
      id: profile.userId || profile.sub,
      name: profile.displayName,
      email: profile.email || `${profile.userId}@line.user`,
      image: profile.pictureUrl,
      role: 'CUSTOMER',
    }
  },
  ...options,
})

export const authOptions: NextAuthOptions = {
  providers: [
    LineProvider(),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
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
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'line') {
        // 檢查用戶是否已存在
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

        if (!existingUser) {
          // 建立新用戶
          const newUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name || '',
              role: 'CUSTOMER',
              password: '',
            },
          })

          // 建立客戶資料
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
          // 更新現有用戶的 LINE ID
          await prisma.customer.updateMany({
            where: { userId: existingUser.id },
            data: { lineId: profile?.sub || null },
          })
        }
      }
    },
  },
} 