/**
 * CSRF Protection for PeiPlay
 * 
 * 實作 Double Submit Cookie 模式的 CSRF 防護
 * - 在 Cookie 中設置 CSRF token
 * - 要求請求 Header 中包含相同的 token
 * - 僅對有 Session 的請求啟用
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import crypto from 'crypto';
import { prisma } from './prisma';

/**
 * CSRF Token 配置
 */
const CSRF_TOKEN_NAME = 'X-CSRF-Token';
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_TOKEN_LENGTH = 32; // 32 bytes = 64 hex characters

/**
 * 生成 CSRF Token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * 驗證 CSRF Token
 */
function verifyCSRFToken(cookieToken: string, headerToken: string): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }

  // 使用 timing-safe comparison 防止時間攻擊
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken, 'hex'),
      Buffer.from(headerToken, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * 獲取客戶端 IP
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

/**
 * 記錄 CSRF 驗證失敗事件
 */
async function logCSRFFailure(
  request: NextRequest,
  userId: string | null
): Promise<void> {
  try {
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await prisma.securityLog.create({
      data: {
        userId: userId || null,
        eventType: 'CSRF_TOKEN_INVALID',
        details: JSON.stringify({
          endpoint: request.nextUrl.pathname,
          method: request.method,
          ip,
          userAgent,
          timestamp: new Date().toISOString(),
        }),
        ipAddress: ip,
        userAgent,
      },
    });
  } catch (error) {
    console.error('❌ Failed to log CSRF failure:', error);
  }
}

/**
 * CSRF 防護中間件
 * 
 * 使用方式：
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const csrfResult = await validateCSRF(request);
 *   if (!csrfResult.valid) {
 *     return csrfResult.response;
 *   }
 *   // ... 處理請求
 * }
 * ```
 */
export async function validateCSRF(
  request: NextRequest
): Promise<{
  valid: boolean;
  response?: NextResponse;
}> {
  // 只對有 Session 的請求進行 CSRF 檢查
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // 沒有 Session，不需要 CSRF 檢查
    return { valid: true };
  }

  // 只對狀態變更方法進行 CSRF 檢查
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(request.method)) {
    return { valid: true };
  }

  // 獲取 Cookie 和 Header 中的 token
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_TOKEN_NAME);

  // 驗證 token
  if (!cookieToken || !headerToken || !verifyCSRFToken(cookieToken, headerToken)) {
    // 記錄失敗事件
    await logCSRFFailure(request, session.user.id);

    return {
      valid: false,
      response: NextResponse.json(
        {
          error: 'CSRF token 驗證失敗',
          message: '請重新載入頁面後再試',
        },
        {
          status: 403,
          headers: {
            'X-CSRF-Error': 'invalid_token',
          },
        }
      ),
    };
  }

  return { valid: true };
}

/**
 * 設置 CSRF Token Cookie
 * 
 * 在登入成功後調用此函數設置 CSRF token
 */
export function setCSRFTokenCookie(response: NextResponse, token: string): NextResponse {
  // 設置 HttpOnly=false 以便前端可以讀取（Double Submit Cookie 需要）
  // 但設置 SameSite=Strict 以防止跨站攻擊
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Double Submit Cookie 需要前端可讀取
    secure: process.env.NODE_ENV === 'production', // 生產環境使用 HTTPS
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });

  return response;
}

/**
 * 獲取當前 CSRF Token（用於前端）
 * 
 * 前端可以調用此 API 獲取 CSRF token
 */
export async function getCSRFToken(request: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  // 從 Cookie 中獲取 token
  const token = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  return token || null;
}

/**
 * 需要 CSRF 保護的 API 路徑模式
 */
export const CSRF_PROTECTED_PATHS = [
  '/api/auth/register',
  '/api/auth/register-secure',
  '/api/user/change-password',
  '/api/user/delete-account',
  '/api/bookings',
  '/api/orders',
  '/api/admin',
  // 添加其他需要保護的路徑
] as const;

/**
 * 檢查路徑是否需要 CSRF 保護
 */
export function requiresCSRFProtection(pathname: string): boolean {
  return CSRF_PROTECTED_PATHS.some((path) => pathname.startsWith(path));
}

