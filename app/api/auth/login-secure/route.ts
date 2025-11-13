import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { SecurityEnhanced, RateLimiter, InputValidator, SecurityLogger } from '@/lib/security-enhanced'

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
    const rateLimitCheck = RateLimiter.checkRateLimit(ipAddress, 5, 15 * 60 * 1000); // 15分鐘內最多5次嘗試
    if (!rateLimitCheck.allowed) {
      SecurityLogger.logSecurityEvent('anonymous', 'LOGIN_RATE_LIMIT_EXCEEDED', {
        ipAddress,
        userAgent,
        email: sanitizedEmail.substring(0, 3) + '***',
        remainingAttempts: rateLimitCheck.remainingAttempts
      });
      
      return NextResponse.json(
        { 
          error: '登入嘗試過於頻繁，請稍後再試',
          remainingAttempts: rateLimitCheck.remainingAttempts
        },
        { status: 429 }
      )
    }

    return await db.query(async (client) => {
      // 查找用戶
      const user = await client.user.findUnique({
        where: { email: sanitizedEmail }
      })

      if (!user) {
        SecurityLogger.logSecurityEvent('anonymous', 'LOGIN_FAILED', {
          event: 'USER_NOT_FOUND',
          ipAddress,
          userAgent,
          email: sanitizedEmail.substring(0, 3) + '***',
        });
        
        throw new Error('Email 或密碼錯誤')
      }

      // 檢查用戶是否被鎖定
      if (user.lockUntil && user.lockUntil > new Date()) {
        SecurityLogger.logSecurityEvent(user.id, 'LOGIN_FAILED', {
          event: 'ACCOUNT_LOCKED',
          ipAddress,
          userAgent,
          lockUntil: user.lockUntil,
        });
        
        throw new Error('帳戶已被鎖定，請稍後再試')
      }

      // 驗證密碼
      const isPasswordValid = await SecurityEnhanced.verifyPassword(password, user.password);
      
      if (!isPasswordValid) {
        // 增加失敗次數
        const newLoginAttempts = user.loginAttempts + 1;
        const shouldLock = newLoginAttempts >= 5;
        
        await client.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: newLoginAttempts,
            lockUntil: shouldLock ? new Date(Date.now() + 30 * 60 * 1000) : null, // 鎖定 30 分鐘
          },
        });

        SecurityLogger.logSecurityEvent(user.id, 'LOGIN_FAILED', {
          event: 'INVALID_PASSWORD',
          ipAddress,
          userAgent,
          attemptCount: newLoginAttempts,
          locked: shouldLock,
        });

        throw new Error(`Email 或密碼錯誤|${Math.max(0, 5 - newLoginAttempts)}`)
      }

      // 登入成功，重置失敗次數
      await client.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockUntil: null,
        },
      });

      // 記錄成功登入
      SecurityLogger.logSecurityEvent(user.id, 'LOGIN_SUCCESS', {
        event: 'LOGIN_SUCCESS',
        ipAddress,
        userAgent,
      });

      // 重置速率限制
      RateLimiter.resetRateLimit(ipAddress);

      return NextResponse.json({
        message: '登入成功',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      })
    }, 'auth/login-secure')

  } catch (error) {
    console.error('登入錯誤:', error)
    if (error instanceof NextResponse) {
      return error
    }
    const errorMessage = error instanceof Error ? error.message : '登入失敗，請稍後再試'
    if (errorMessage.includes('|')) {
      const [msg, remaining] = errorMessage.split('|')
      return NextResponse.json(
        { 
          error: msg,
          remainingAttempts: parseInt(remaining) || 0
        },
        { status: 401 }
      )
    }
    const status = errorMessage.includes('已被鎖定') ? 423 :
                   errorMessage.includes('Email 或密碼錯誤') ? 401 : 500
    return NextResponse.json(
      { error: errorMessage },
      { status }
    )
  }
}
