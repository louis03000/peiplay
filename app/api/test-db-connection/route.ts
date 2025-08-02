import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('Testing database connection...')
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set')
    
    // 測試資料庫連接
    await prisma.$connect()
    console.log('Database connection successful')
    
    // 測試簡單查詢
    const partnerCount = await prisma.partner.count()
    console.log(`Found ${partnerCount} partners in database`)
    
    // 測試更複雜的查詢
    const approvedPartners = await prisma.partner.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, name: true, status: true }
    })
    
    console.log(`Found ${approvedPartners.length} approved partners`)
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      partnerCount,
      approvedPartnerCount: approvedPartners.length,
      databaseUrl: process.env.DATABASE_URL ? 'Configured' : 'Not configured'
    })
    
  } catch (error) {
    console.error('Database connection test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: process.env.DATABASE_URL ? 'Configured' : 'Not configured'
    }, { status: 500 })
    
  } finally {
    await prisma.$disconnect()
  }
} 