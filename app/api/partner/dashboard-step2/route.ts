import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log('🚀 Step 2: Database connection test');
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }
    
    console.log('📝 Testing database connection...');
    
    // 簡單的資料庫查詢測試
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        isAvailableNow: true
      }
    });
    
    console.log('✅ Database query successful');
    
    return NextResponse.json({
      status: 'success',
      message: 'Database connection working',
      partner: partner || null
    });
    
  } catch (error) {
    console.error('❌ Step 2 error:', error);
    return NextResponse.json({
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
