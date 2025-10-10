import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { sendEmailVerificationCode } from '@/lib/email'
import { SecurityEnhanced, RateLimiter, InputValidator, SecurityLogger } from '@/lib/security-enhanced'

export const dynamic = 'force-dynamic';

async function registerHandler(request: Request) {
  try {
    const data = await request.json()
    const { email, password, name, birthday, phone, discord } = data

    // 檢查速率限制
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = RateLimiter.checkRateLimit(clientIp, 5, 15 * 60 * 1000) // 15分鐘內最多5次嘗試
    
    if (!rateLimit.allowed) {
      SecurityLogger.logSecurityEvent('anonymous', 'RATE_LIMIT_EXCEEDED', {
        ip: clientIp,
        remainingAttempts: rateLimit.remainingAttempts,
        resetTime: new Date(rateLimit.resetTime).toISOString()
      })
      
      return NextResponse.json(
        { error: `註冊嘗試次數過多，請 ${Math.ceil((rateLimit.resetTime - Date.now()) / 60000)} 分鐘後再試` },
        { status: 429 }
      )
    }

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

    // 驗證密碼強度
    const passwordValidation = SecurityEnhanced.validatePassword(sanitizedData.password);
    if (!passwordValidation.isValid) {
      SecurityLogger.logSecurityEvent('anonymous', 'WEAK_PASSWORD_ATTEMPT', {
        email: sanitizedData.email.substring(0, 3) + '***',
        errors: passwordValidation.errors,
        strength: passwordValidation.strength
      })
      
      return NextResponse.json(
        { error: '密碼不符合安全要求', details: passwordValidation.errors },
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
        { error: 'Discord ID 格式無效' },
        { status: 400 }
      )
    }

    // 檢查郵箱是否已被註冊
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '此郵箱已被註冊' },
        { status: 400 }
      )
    }

    // 檢查年齡限制（18歲以上）
    const today = new Date();
    const birthDate = new Date(sanitizedData.birthday);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // 如果還沒到生日，年齡減1
    const actualAge = (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) 
      ? age - 1 
      : age;
    
    if (actualAge < 18) {
      return NextResponse.json(
        { error: '您必須年滿18歲才能註冊' },
        { status: 400 }
      )
    }

    // 加密密碼
    const hashedPassword = await SecurityEnhanced.hashPassword(sanitizedData.password)

    // 檢查是否為管理員帳號
    const isAdminEmail = sanitizedData.email === 'peiplay2025@gmail.com';
    
    // 生成 6 位數驗證碼
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 設定過期時間（10分鐘後）
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // 創建用戶
    const user = await prisma.user.create({
      data: {
        email: sanitizedData.email,
        password: hashedPassword,
        name: sanitizedData.name,
        birthday: new Date(sanitizedData.birthday),
        phone: sanitizedData.phone,
        discord: sanitizedData.discord,
        role: isAdminEmail ? 'ADMIN' : 'CUSTOMER',
        emailVerified: isAdminEmail, // 管理員帳號直接設為已驗證
        emailVerificationCode: isAdminEmail ? null : verificationCode,
        emailVerificationExpires: isAdminEmail ? null : expiresAt,
      },
    })

    // 記錄安全事件
    SecurityLogger.logSecurityEvent(
      user.id,
      'USER_REGISTRATION_SUCCESS',
      { 
        email: sanitizedData.email.substring(0, 3) + '***',
        registrationTime: new Date().toISOString() 
      }
    );

    // 如果是管理員帳號，直接返回成功
    if (isAdminEmail) {
      return NextResponse.json({ 
        message: '管理員帳號註冊成功，可直接登入',
        email: sanitizedData.email,
        isAdmin: true
      })
    }

    // 發送驗證碼 Email（僅限非管理員帳號）
    const emailSent = await sendEmailVerificationCode(
      sanitizedData.email,
      sanitizedData.name,
      verificationCode
    );

    if (!emailSent) {
      // 如果發送失敗，刪除剛創建的用戶
      await prisma.user.delete({
        where: { id: user.id }
      });
      
      return NextResponse.json(
        { error: '發送驗證碼失敗，請稍後再試' },
        { status: 500 }
      )
    }

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

    // 記錄成功的註冊
    SecurityLogger.logSecurityEvent(user.id, 'USER_REGISTERED', {
      email: sanitizedData.email.substring(0, 3) + '***',
      hasPhone: !!sanitizedData.phone,
      hasDiscord: !!sanitizedData.discord,
      isAdmin: isAdminEmail
    })

    // 重置速率限制
    RateLimiter.resetRateLimit(clientIp)

    return NextResponse.json({ 
      message: '註冊成功，請檢查您的 Email 並完成驗證',
      email: sanitizedData.email 
    })
  } catch (error) {
    console.error('Error registering user:', error)
    
    // 記錄安全事件
    SecurityLogger.logSecurityEvent('anonymous', 'REGISTRATION_ERROR', {
      additionalInfo: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
    
    return NextResponse.json(
      { error: '註冊失敗' },
      { status: 500 }
    )
  }
}

// 導出處理函數
export const POST = registerHandler;

// 新增這段
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}