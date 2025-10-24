import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log('🚀 Auth test API triggered');
  
  try {
    // 檢查環境變數
    const envCheck = {
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT_SET',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'SET' : 'NOT_SET',
      LINE_CLIENT_ID: process.env.LINE_CLIENT_ID ? 'SET' : 'NOT_SET',
      LINE_CLIENT_SECRET: process.env.LINE_CLIENT_SECRET ? 'SET' : 'NOT_SET',
    };
    
    console.log('🔍 Auth environment check:', envCheck);
    
    // 測試 NextAuth session
    let session = null;
    let sessionError = null;
    
    try {
      session = await getServerSession(authOptions);
      console.log('🔍 Session result:', session ? 'Session found' : 'No session');
    } catch (error) {
      sessionError = error;
      console.error('❌ Session error:', error);
    }
    
    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      environment: envCheck,
      session: {
        exists: !!session,
        userId: session?.user?.id || null,
        userRole: session?.user?.role || null
      },
      sessionError: sessionError ? {
        message: sessionError instanceof Error ? sessionError.message : 'Unknown error',
        stack: sessionError instanceof Error ? sessionError.stack : undefined
      } : null
    });
    
  } catch (error) {
    console.error('❌ Auth test API error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
