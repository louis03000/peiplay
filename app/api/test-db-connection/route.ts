import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    console.log('Testing database connection...')
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set')
    
    // 測試資料庫連接和查詢
    const result = await db.query(async (client) => {
      console.log('Database connection successful')
      
      // 測試簡單查詢
      const partnerCount = await client.partner.count()
      console.log(`Found ${partnerCount} partners in database`)
      
      // 測試更複雜的查詢
      const approvedPartners = await client.partner.findMany({
        where: { status: 'APPROVED' },
        select: { id: true, name: true, status: true }
      })
      
      console.log(`Found ${approvedPartners.length} approved partners`)
      
      return { partnerCount, approvedPartnerCount: approvedPartners.length }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      partnerCount: result.partnerCount,
      approvedPartnerCount: result.approvedPartnerCount,
      databaseUrl: process.env.DATABASE_URL ? 'Configured' : 'Not configured'
    })
    
  } catch (error) {
    console.error('Database connection test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: process.env.DATABASE_URL ? 'Configured' : 'Not configured'
    }, { status: 500 })
  }
} 