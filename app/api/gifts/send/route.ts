import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { receiverId, giftName, channelId } = await request.json()
    
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
    
    // 檢查用戶金幣餘額 - 暫時註解，移除金幣檢查
    // const userCoins = await prisma.userCoins.findUnique({
    //   where: { userId: session.user.id }
    // })
    
    // if (!userCoins || userCoins.coinBalance < gift.coinCost) {
    //   return NextResponse.json({ 
    //     error: '金幣不足',
    //     required: gift.coinCost,
    //     current: userCoins?.coinBalance || 0
    //   }, { status: 400 })
    // }
    
    // 使用事務確保資料一致性
    const result = await prisma.$transaction(async (tx) => {
      // 扣除發送者金幣 - 暫時註解，移除金幣扣除
      // const updatedCoins = await tx.userCoins.update({
      //   where: { userId: session.user.id },
      //   data: { coinBalance: { decrement: gift.coinCost } }
      // })
      
      // 記錄消費交易 - 暫時註解，移除金幣交易記錄
      // await tx.coinTransaction.create({
      //   data: {
      //     userId: session.user.id,
      //     transactionType: 'GIFT',
      //     amount: gift.coinCost,
      //     description: `贈送禮物 ${gift.name} 給 ${receiverId}`,
      //     balanceBefore: updatedCoins.coinBalance + gift.coinCost,
      //     balanceAfter: updatedCoins.coinBalance
      //   }
      // })
      
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
          discordChannelId: channelId
        }
      })
      
      return {
        giftRecord,
        newBalance: 0, // 暫時移除金幣餘額
        partnerEarnings: partnerEarnings
      }
    })
    
    return NextResponse.json({
      success: true,
      gift: {
        name: gift.name,
        emoji: gift.emoji,
        coins: gift.coinCost,
        partnerEarned: Math.floor(gift.coinCost * Number(gift.partnerShare))
      },
      newBalance: result.newBalance
    })
    
  } catch (error) {
    console.error('贈送禮物失敗:', error)
    return NextResponse.json({ error: '贈送禮物失敗，請重試' }, { status: 500 })
  }
}
