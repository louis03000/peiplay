import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查所有夥伴資料
    const partners = await prisma.partner.findMany({
      include: { user: true }
    })
    
    // 檢查客戶資料
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    })

    // 移除金幣檢查

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role
      },
      customer: customer ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone
      } : null,
      // 移除金幣資訊
      partners: partners.map(p => ({
        id: p.id,
        name: p.name,
        isAvailableNow: p.isAvailableNow,
        halfHourlyRate: p.halfHourlyRate,
        status: p.status,
        userId: p.userId
      }))
    })
  } catch (error) {
    console.error('診斷失敗:', error)
    return NextResponse.json({ 
      error: '診斷失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
