import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { SecurityEnhanced } from '@/lib/security-enhanced'
import { sendEmailVerificationCode } from '@/lib/email'
import { InputValidator } from '@/lib/security'
import { withRateLimit } from '@/lib/middleware-rate-limit'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 速率限制檢查（3 次 / 小時）
    const rateLimitResult = await withRateLimit(request, { 
      preset: 'REGISTER',
      endpoint: '/api/auth/register-secure'
    });
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }

    const data = await request.json()
    const { email, password, name, birthday, phone, discord } = data

    // 輸入驗證和清理
    const sanitizedData = InputValidator.sanitizeUserInput({
      email: email?.trim(),
      password,
      name: name?.trim(),
      birthday,
      phone: phone?.trim(),
      discord: discord?.trim()
    });

    // 驗證 Email 格式
    if (!InputValidator.isValidEmail(sanitizedData.email)) {
      return NextResponse.json(
        { error: 'Email 格式無效' },
        { status: 400 }
      )
    }

    // 增強密碼強度檢查 + 洩露檢查
    const passwordValidation = SecurityEnhanced.validatePassword(sanitizedData.password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: '密碼不符合安全要求', details: passwordValidation.errors },
        { status: 400 }
      )
    }

    // 檢查密碼是否在洩露列表中
    const breachCheck = await validatePasswordWithBreachCheck(sanitizedData.password);
    if (!breachCheck.valid) {
      return NextResponse.json(
        { 
          error: breachCheck.error || '密碼不符合安全要求',
          breached: breachCheck.breached,
          breachCount: breachCheck.breachCount,
        },
        { status: 400 }
      )
    }

    // 驗證電話號碼
    if (sanitizedData.phone && !InputValidator.isValidPhone(sanitizedData.phone)) {
      return NextResponse.json(
        { error: '電話號碼格式無效' },
        { status: 400 }
      )
    }

    // 驗證 Discord ID
    if (sanitizedData.discord && !InputValidator.isValidDiscordId(sanitizedData.discord)) {
      return NextResponse.json(
        { error: 'Discord 格式無效' },
        { status: 400 }
      )
    }

    return await db.query(async (client) => {
      // 檢查用戶是否已存在
      const existingUser = await client.user.findUnique({
        where: { email: sanitizedData.email }
      })

      if (existingUser) {
        throw new Error('此 Email 已被註冊')
      }

      // 使用增強密碼雜湊
      const hashedPassword = await SecurityEnhanced.hashPassword(sanitizedData.password)

      // 生成驗證碼
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10分鐘後過期

      // 創建用戶
      const user = await client.user.create({
        data: {
          email: sanitizedData.email,
          password: hashedPassword,
          name: sanitizedData.name,
          birthday: sanitizedData.birthday ? new Date(sanitizedData.birthday) : new Date('2000-01-01'),
          phone: sanitizedData.phone || '',
          discord: sanitizedData.discord,
          emailVerificationCode: verificationCode,
          emailVerificationExpires: expiresAt,
        },
      })

      // 發送驗證郵件
      await sendEmailVerificationCode(sanitizedData.email, verificationCode, user.name || '用戶')

      // 記錄安全事件
      await SecurityEnhanced.logSecurityEvent(user.id, 'LOGIN_ATTEMPT', {
        event: 'REGISTRATION',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      })

      // 邀請用戶加入 Discord 伺服器
      try {
        if (sanitizedData.discord) {
          const discordInviteResponse = await fetch('http://localhost:5001/invite_user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              discord_name: sanitizedData.discord,
              user_name: sanitizedData.name,
              user_email: sanitizedData.email,
            }),
          });

          if (discordInviteResponse.ok) {
            console.log(`✅ Discord 邀請已發送: ${sanitizedData.discord}`);
          } else {
            console.log(`⚠️ Discord 邀請失敗: ${sanitizedData.discord}`);
          }
        }
      } catch (error) {
        console.error('Discord 邀請錯誤:', error);
        // 不影響註冊流程，只記錄錯誤
      }

      return NextResponse.json({ 
        message: '註冊成功，請檢查您的 Email 並完成驗證',
        email: sanitizedData.email,
        securityLevel: 'enhanced'
      })
    }, 'auth/register-secure')

  } catch (error) {
    console.error('註冊錯誤:', error)
    if (error instanceof NextResponse) {
      return error
    }
    const errorMessage = error instanceof Error ? error.message : '註冊失敗，請稍後再試'
    const status = errorMessage.includes('已被註冊') || errorMessage.includes('格式無效') || 
                   errorMessage.includes('安全要求') ? 400 : 500
    return NextResponse.json(
      { error: errorMessage },
      { status }
    )
  }
}
