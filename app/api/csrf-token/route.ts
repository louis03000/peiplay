/**
 * CSRF Token API
 * 
 * 提供 CSRF token 給前端使用
 * 前端應該在登入後調用此 API 獲取 CSRF token
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { generateCSRFToken, setCSRFTokenCookie, getCSRFToken } from '@/lib/csrf-protection';

export const dynamic = 'force-dynamic';

/**
 * GET /api/csrf-token
 * 
 * 獲取或刷新 CSRF token
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: '需要登入' },
      { status: 401 }
    );
  }

  // 檢查是否已有 token
  let token = getCSRFToken(request);
  
  // 如果沒有 token，生成新的
  if (!token) {
    token = generateCSRFToken();
  }

  const response = NextResponse.json({
    token,
    message: 'CSRF token 已生成',
  });

  // 設置 CSRF token cookie
  return setCSRFTokenCookie(response, token);
}

