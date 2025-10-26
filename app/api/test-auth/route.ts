import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('🔐 測試認證 API 開始...')
    
    const session = await getServerSession(authOptions);
    console.log('🔐 Session 結果:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userRole: session?.user?.role
    });
    
    return NextResponse.json({
      success: true,
      session: session ? {
        hasUser: !!session.user,
        userId: session.user?.id,
        userEmail: session.user?.email,
        userRole: session.user?.role
      } : null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 認證測試失敗:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
