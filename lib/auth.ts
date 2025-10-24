import { NextAuthOptions } from 'next-auth'
import { prisma } from './prisma'
import { UserRole } from '@prisma/client'
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import LineProvider from 'next-auth/providers/line'
import { getServerSession } from 'next-auth/next'
import { SecurityLogger, IPFilter } from './security'

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
        
        // 獲取客戶端 IP（如果可用）
        const clientIP = 'unknown'; // 在 authorize 中無法直接獲取 IP
        
        try {
          const user = await prisma.user.findUnique({ where: { email: credentials.email } });
          if (!user) {
            SecurityLogger.logFailedLogin(credentials.email, clientIP, 'unknown');
            throw new Error('尚未註冊，請先註冊');
          }
          
          // 檢查 Email 是否已驗證（管理員帳號除外）
          if (!(user as any).emailVerified && user.role !== 'ADMIN') {
            SecurityLogger.logFailedLogin(credentials.email, clientIP, 'email_not_verified');
            throw new Error('請先完成 Email 驗證才能登入');
          }
          
          const isValid = await compare(credentials.password, user.password);
          if (!isValid) {
            SecurityLogger.logFailedLogin(credentials.email, clientIP, 'invalid_password');
            return null;
          }
          
          // 記錄成功登入
          SecurityLogger.logSuccessfulLogin(user.id, user.email, clientIP);
          
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            provider: 'credentials',
          };
        } catch (error) {
          SecurityLogger.logSecurityEvent('LOGIN_ERROR', {
            ip: clientIP,
            additionalInfo: { 
              email: credentials.email,
              error: error instanceof Error ? error.message : 'Unknown error' 
            }
          });
          throw error;
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      // 確保 session.user 一定存在
      session.user = session.user || {};
        session.user.id = token.sub as string;
        session.user.role = token.role as UserRole;
        session.user.provider = token.provider as string;
      return session;
    },
    async jwt({ token, user, account, profile }) {
      // 新登入時
      if (user) {
        token.sub = user.id;
        token.provider = account?.provider;
        token.role = user.role;
      }
      // 只在沒有 role 時才查 DB
      if (!token.role && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({ where: { id: token.sub as string } });
          if (dbUser) {
            token.role = dbUser.role;
          }
        } catch (error) {
          console.error('JWT callback DB error:', error);
          // 如果 DB 查詢失敗，使用預設 role
          token.role = 'CUSTOMER';
        }
      }
      return token;
    },
    async signIn({ user, account, profile }) {
      if (!user?.id) return false;

      let userId = user.id;
      let lineId = account?.provider === 'line' ? profile?.sub : null;

      // 確保 User 記錄存在
      let dbUser = await prisma.user.findUnique({ where: { id: userId } });
      let isNewUser = false;
      
      if (!dbUser) {
        // 如果 User 不存在，創建一個
        dbUser = await prisma.user.create({
          data: {
            id: userId,
            email: user.email || `line_${lineId}@example.com`,
            password: '', // LINE 用戶不需要密碼
            name: user.name || 'New User',
            role: 'CUSTOMER',
            phone: '',
            birthday: new Date('2000-01-01'),
          },
        });
        isNewUser = true;
        console.log('新用戶已創建:', dbUser.id);
      }

      // 如果是 line 登入，先查 lineId 對應的 customer
      let existCustomer = null;
      if (lineId) {
        existCustomer = await prisma.customer.findUnique({ where: { lineId } });
        if (existCustomer) {
          userId = existCustomer.userId;
        }
      }

      // 如果還沒查到 customer，再用 userId 查
      if (!existCustomer) {
        existCustomer = await prisma.customer.findUnique({ where: { userId } });
      }

      // 沒有才建立
      if (!existCustomer) {
        await prisma.customer.create({
          data: {
            userId,
            name: user.name || 'New User',
            phone: '',
            birthday: new Date('2000-01-01'),
            lineId,
          },
        });
      } else if (lineId && !existCustomer.lineId) {
        await prisma.customer.update({
          where: { userId },
          data: { lineId }
        });
      }

      return true;
    },
    async redirect({ url, baseUrl }) {
      console.log('Redirect callback:', { url, baseUrl });
      
      // 如果是 signin 成功，跳轉到首頁，讓前端處理 onboarding
      if (url.includes('signin')) {
        return `${baseUrl}/`;
      }
      
      // 其他情況保持原來的行為
      return url.startsWith(baseUrl) ? url : baseUrl;
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