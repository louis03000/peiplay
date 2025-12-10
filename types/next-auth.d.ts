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
      phone?: string | null
      birthday?: string | null
      discord?: string | null
      partnerId?: string | null
      partnerStatus?: string | null
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
    phone?: string | null
    birthday?: string | null
    discord?: string | null
    partnerId?: string | null
    partnerStatus?: string | null
  }
} 