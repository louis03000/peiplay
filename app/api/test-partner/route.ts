import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 檢查所有夥伴資料
    const partners = await prisma.partner.findMany({
      include: { user: true }
    })
    
    console.log('所有夥伴資料:', partners)
    
    return NextResponse.json({
      partners: partners.map(p => ({
        id: p.id,
        name: p.name,
        isAvailableNow: p.isAvailableNow,
        halfHourlyRate: p.halfHourlyRate,
        status: p.status
      }))
    })
  } catch (error) {
    console.error('檢查夥伴資料失敗:', error)
    return NextResponse.json({ 
      error: '檢查失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
