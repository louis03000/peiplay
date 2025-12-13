/**
 * Recovery Codes API
 * 
 * 重新生成 recovery codes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { regenerateRecoveryCodes } from '@/lib/mfa-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { recoveryCodes } = await regenerateRecoveryCodes(session.user.id);

    return NextResponse.json({
      success: true,
      recoveryCodes,
      message: 'Recovery codes 已重新生成，請妥善保存',
      warning: '舊的 recovery codes 已失效',
    });
  } catch (error) {
    console.error('Recovery codes regeneration error:', error);
    return NextResponse.json(
      { error: '重新生成 recovery codes 失敗' },
      { status: 500 }
    );
  }
}

