import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SecurityEnhanced } from '@/lib/security-enhanced'
import { signIn } from 'next-auth/react'
import { InputValidator } from '@/lib/security'

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { email, password } = data

    // 輸入驗證
    const sanitizedEmail = InputValidator.sanitizeUserInput({ email: email?.trim() }).email;
    
    if (!InputValidator.isValidEmail(sanitizedEmail)) {
      return NextResponse.json(
        { error: 'Email 格式無效' },
        { status: 400 }
      )
    }

    // 獲取客戶端 IP 和 User Agent
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 檢查登入頻率限制
    const rateLimitCheck = await SecurityEnhanced.checkLoginRateLimit(ipAddress);
    if (!rateLimitCheck.allowed) {
      await SecurityEnhanced.logSecurityEvent('system', 'SUSPICIOUS_ACTIVITY', {
        event: 'RATE_LIMIT_EXCEEDED',
        ipAddress,
        userAgent,
        email: sanitizedEmail,
      });
      
      return NextResponse.json(
        { 
          error: '登入嘗試過於頻繁，請稍後再試',
          remainingAttempts: rateLimitCheck.remainingAttempts
        },
        { status: 429 }
      )
    }

    // 查找用戶
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail }
    })

    if (!user) {
      await SecurityEnhanced.logSecurityEvent('system', 'LOGIN_FAILED', {
        event: 'USER_NOT_FOUND',
        ipAddress,
        userAgent,
        email: sanitizedEmail,
      });
      
      return NextResponse.json(
        { error: 'Email 或密碼錯誤' },
        { status: 401 }
      )
    }

    // 檢查用戶是否被鎖定
    if (user.lockUntil && user.lockUntil > new Date()) {
      await SecurityEnhanced.logSecurityEvent(user.id, 'LOGIN_FAILED', {
        event: 'ACCOUNT_LOCKED',
        ipAddress,
        userAgent,
        lockUntil: user.lockUntil,
      });
      
      return NextResponse.json(
        { error: '帳戶已被鎖定，請稍後再試' },
        { status: 423 }
      )
    }

    // 驗證密碼
    const isPasswordValid = await SecurityEnhanced.verifyPassword(password, user.password);
    
    if (!isPasswordValid) {
      // 增加失敗次數
      const newLoginAttempts = user.loginAttempts + 1;
      const shouldLock = newLoginAttempts >= 5;
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newLoginAttempts,
          lockUntil: shouldLock ? new Date(Date.now() + 30 * 60 * 1000) : null, // 鎖定 30 分鐘
        },
      });

      await SecurityEnhanced.logSecurityEvent(user.id, 'LOGIN_FAILED', {
        event: 'INVALID_PASSWORD',
        ipAddress,
        userAgent,
        attemptCount: newLoginAttempts,
        locked: shouldLock,
      });

      return NextResponse.json(
        { 
          error: 'Email 或密碼錯誤',
          remainingAttempts: Math.max(0, 5 - newLoginAttempts)
        },
        { status: 401 }
      )
    }

    // 登入成功，重置失敗次數
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockUntil: null,
      },
    });

    // 檢查密碼年齡
    const passwordAgeCheck = await SecurityEnhanced.checkPasswordAge(user.id);
    
    // 記錄成功登入
    await SecurityEnhanced.logSecurityEvent(user.id, 'LOGIN_SUCCESS', {
      event: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent,
      passwordAge: passwordAgeCheck.daysSinceLastUpdate,
    });

    // 生成 JWT token（這裡簡化處理，實際應使用 NextAuth）
    const token = SecurityEnhanced.generateSecureToken();

    return NextResponse.json({
      message: '登入成功',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
      passwordNeedsUpdate: passwordAgeCheck.needsUpdate,
      daysSinceLastPasswordUpdate: passwordAgeCheck.daysSinceLastUpdate,
    })

  } catch (error) {
    console.error('登入錯誤:', error)
    return NextResponse.json(
      { error: '登入失敗，請稍後再試' },
      { status: 500 }
    )
  }
}
