import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log('🚀 Step 1: Basic auth test');
  
  try {
    const session = await getServerSession(authOptions);
    console.log('📝 Session result:', session ? 'Found' : 'Not found');
    
    if (!session?.user?.id) {
      console.log('❌ No user session');
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }
    
    console.log('✅ User authenticated:', session.user.id);
    
    return NextResponse.json({
      status: 'success',
      message: 'Authentication working',
      userId: session.user.id,
      userRole: session.user.role
    });
    
  } catch (error) {
    console.error('❌ Step 1 error:', error);
    return NextResponse.json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
