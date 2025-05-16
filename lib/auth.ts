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
      email: profile.email || '',
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
    newUser: '/partners',
    error: '/auth/login',
  },
  session: {
    strategy: 'jwt',
  },
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'line' && !user.email) {
        throw new Error('/profile')
      }
    },
  },
} 