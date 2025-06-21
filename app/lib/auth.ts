import { AuthOptions } from 'next-auth'
import LineProvider from 'next-auth/providers/line'

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
      }
      return session
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token
        token.sub = user.id
      }
      return token
    }
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error'
  }
} 