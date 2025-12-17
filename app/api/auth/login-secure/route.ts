import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { SecurityEnhanced, InputValidator, SecurityLogger } from '@/lib/security-enhanced'
import { withRateLimit } from '@/lib/middleware-rate-limit'
import { generateCSRFToken, setCSRFTokenCookie } from '@/lib/csrf-protection'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 速率限制檢查（5 次 / 分鐘）
    const rateLimitResult = await withRateLimit(request, { 
      preset: 'AUTH',
      endpoint: '/api/auth/login-secure'
    });
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }

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

    return await db.query(async (client) => {
      // 查找用戶
      const user = await client.user.findUnique({
        where: { email: sanitizedEmail },
        select: {
          id: true,
          email: true,
          password: true,
          name: true,
          role: true,
          emailVerified: true,
          isTwoFactorEnabled: true,
          lockUntil: true,
          loginAttempts: true,
        },
      })

      if (!user) {
        await SecurityLogger.logFailedLogin(sanitizedEmail, ipAddress, userAgent, null);
        
        throw new Error('尚未註冊 請先註冊帳號')
      }

      // 管理員帳號跳過所有驗證檢查
      const isAdmin = user.role === 'ADMIN';

      // 檢查用戶是否被鎖定（管理員除外）
      if (!isAdmin && user.lockUntil && user.lockUntil > new Date()) {
        await SecurityLogger.logSuspiciousActivity(user.id, 'ACCOUNT_LOCKED', {
          lockUntil: user.lockUntil,
        }, request);
        
        throw new Error('帳戶已被鎖定，請稍後再試')
      }

      // 驗證密碼
      const isPasswordValid = await SecurityEnhanced.verifyPassword(password, user.password);
      
      if (!isPasswordValid) {
        // 管理員帳號不增加失敗次數，也不鎖定
        if (!isAdmin) {
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

          await SecurityLogger.logFailedLogin(user.email, ipAddress, userAgent, user.id);

          throw new Error(`Email 或密碼錯誤|${Math.max(0, 5 - newLoginAttempts)}`)
        } else {
          await SecurityLogger.logFailedLogin(user.email, ipAddress, userAgent, user.id);
          throw new Error('Email 或密碼錯誤')
        }
      }

      // 管理員帳號跳過 MFA 驗證
      if (!isAdmin) {
        // 檢查是否需要 MFA 驗證
        const { requiresMFA } = await import('@/lib/mfa-service');
        const needsMFA = await requiresMFA(user.id);

        // 如果已啟用 MFA，需要驗證碼
        if (needsMFA) {
          // 重置失敗次數（但未完成 MFA 驗證）
          await client.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: 0,
              lockUntil: null,
            },
          });

          return NextResponse.json({
            message: '需要雙因素認證',
            requireMFA: true,
            requireMFASetup: false,
            userId: user.id,
          }, { status: 200 });
        }
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
      await SecurityLogger.logSuccessfulLogin(user.id, user.email, ipAddress, userAgent);

      // 生成並設置 CSRF token
      const csrfToken = generateCSRFToken();
      const response = NextResponse.json({
        message: '登入成功',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });

      // 設置 CSRF token cookie
      return setCSRFTokenCookie(response, csrfToken);
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
