import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log('🔍 DEBUG API - Function started');
  
  try {
    // 檢查環境變數
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT_SET',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'SET' : 'NOT_SET',
    };
    
    console.log('🔍 Environment check:', envCheck);
    
    // 測試基本功能
    const result = {
      status: 'success',
      timestamp: new Date().toISOString(),
      environment: envCheck,
      message: 'Debug API is working correctly'
    };
    
    console.log('🔍 Debug result:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ DEBUG API ERROR:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
