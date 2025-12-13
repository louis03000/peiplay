/**
 * MFA Verification API
 * 
 * 在登入流程中驗證 MFA（TOTP 或 Recovery Code）
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyMFA } from '@/lib/mfa-service';
import { generateCSRFToken, setCSRFTokenCookie } from '@/lib/csrf-protection';
import { SecurityLogger } from '@/lib/security-enhanced';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId, code } = await request.json();

    if (!userId || !code) {
      return NextResponse.json(
        { error: '用戶 ID 和驗證碼為必填' },
        { status: 400 }
      );
    }

    // 驗證 MFA
    const result = await verifyMFA(userId, code, request);

    if (!result.valid) {
      return NextResponse.json(
        { 
          error: '驗證碼無效',
          message: '請檢查您的驗證碼或 recovery code 是否正確',
        },
        { status: 401 }
      );
    }

    // MFA 驗證成功，完成登入流程
    const user = await db.query(async (client) => {
      return client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });
    }, 'auth/mfa-verify');

    if (!user) {
      return NextResponse.json(
        { error: '用戶不存在' },
        { status: 404 }
      );
    }

    // 記錄成功登入（包含 MFA）
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    await SecurityLogger.logSuccessfulLogin(user.id, user.email, ipAddress, userAgent);

    // 如果使用了 recovery code，提醒用戶
    const response = NextResponse.json({
      message: '登入成功',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      usedRecoveryCode: result.usedRecoveryCode,
      warning: result.usedRecoveryCode 
        ? '您使用了 recovery code，建議重新生成新的 recovery codes'
        : undefined,
    });

    // 設置 CSRF token cookie
    const csrfToken = generateCSRFToken();
    return setCSRFTokenCookie(response, csrfToken);
  } catch (error) {
    console.error('MFA verification error:', error);
    return NextResponse.json(
      { error: 'MFA 驗證失敗，請稍後再試' },
      { status: 500 }
    );
  }
}

