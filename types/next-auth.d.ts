import 'next-auth'
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email: string
      image?: string | null
      role: string
      lineId?: string
      twoFactorSecret?: string | null
      isTwoFactorEnabled?: boolean
    }
  }

  interface User {
    id: string
    name?: string | null
    email: string
    image?: string | null
    role: string
    lineId?: string
    twoFactorSecret?: string | null
    isTwoFactorEnabled?: boolean
  }
} 