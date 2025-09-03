import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // 獲取所有可用的禮物
    const gifts = await prisma.giftItem.findMany({
      where: { isActive: true },
      orderBy: { coinCost: 'asc' }
    })

    return NextResponse.json({
      success: true,
      gifts: gifts
    })

  } catch (error) {
    console.error('獲取禮物列表失敗:', error)
    return NextResponse.json({ error: '獲取禮物列表失敗' }, { status: 500 })
  }
}
