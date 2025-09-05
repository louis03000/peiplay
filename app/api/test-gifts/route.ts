import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 獲取禮物列表
    const gifts = await prisma.giftItem.findMany({
      where: { isActive: true },
      orderBy: { coinCost: 'asc' }
    })

    // 獲取用戶列表
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true
      },
      where: {
        id: { not: session.user.id }
      }
    })

    return NextResponse.json({
      success: true,
      gifts: gifts,
      users: users
    })

  } catch (error) {
    console.error('測試送禮物API失敗:', error)
    return NextResponse.json({ error: '測試失敗' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { receiverId, giftName } = await request.json()
    
    if (!receiverId || !giftName) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }
    
    // 檢查禮物是否存在
    const gift = await prisma.giftItem.findFirst({
      where: { name: giftName, isActive: true }
    })
    
    if (!gift) {
      return NextResponse.json({ error: '禮物不存在' }, { status: 404 })
    }
    
    // 使用事務確保資料一致性
    const result = await prisma.$transaction(async (tx) => {
      // 增加接收者收益
      const partnerEarnings = await tx.partnerEarnings.upsert({
        where: { partnerId: receiverId },
        update: { 
          totalEarnedCoins: { increment: Math.floor(gift.coinCost * Number(gift.partnerShare)) },
          pendingEarningsCoins: { increment: Math.floor(gift.coinCost * Number(gift.partnerShare)) }
        },
        create: {
          partnerId: receiverId,
          totalEarnedCoins: Math.floor(gift.coinCost * Number(gift.partnerShare)),
          pendingEarningsCoins: Math.floor(gift.coinCost * Number(gift.partnerShare))
        }
      })
      
      // 記錄禮物贈送
      const giftRecord = await tx.giftRecord.create({
        data: {
          senderId: session.user.id,
          receiverId: receiverId,
          giftId: gift.id,
          coinsSpent: gift.coinCost,
          partnerEarnedCoins: Math.floor(gift.coinCost * Number(gift.partnerShare)),
          platformEarnedCoins: Math.floor(gift.coinCost * Number(gift.partnerShare)),
          discordChannelId: 'test-channel-123'
        }
      })
      
      return {
        giftRecord,
        partnerEarnings: partnerEarnings
      }
    })
    
    return NextResponse.json({
      success: true,
      message: `成功贈送 ${gift.emoji} ${gift.name}！`,
      gift: {
        name: gift.name,
        emoji: gift.emoji,
        coins: gift.coinCost,
        partnerEarned: Math.floor(gift.coinCost * Number(gift.partnerShare))
      }
    })
    
  } catch (error) {
    console.error('贈送禮物失敗:', error)
    return NextResponse.json({ error: '贈送禮物失敗，請重試' }, { status: 500 })
  }
}
