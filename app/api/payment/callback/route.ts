import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendNotification, NotificationType } from '@/lib/notifications'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 綠界金流設定
const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691',
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6'
}

// 自定義 URLEncode 函數，使用舊版標準（空格編碼為 +）
function customUrlEncode(str: string): string {
  return str.replace(/\+/g, '%2B')
            .replace(/\s/g, '+')
            .replace(/"/g, '%22')
            .replace(/'/g, '%27')
            .replace(/</g, '%3C')
            .replace(/>/g, '%3E')
            .replace(/#/g, '%23')
            .replace(/%/g, '%25')
            .replace(/\{/g, '%7B')
            .replace(/\}/g, '%7D')
            .replace(/\|/g, '%7C')
            .replace(/\\/g, '%5C')
            .replace(/\^/g, '%5E')
            .replace(/\[/g, '%5B')
            .replace(/\]/g, '%5D')
            .replace(/`/g, '%60')
            .replace(/;/g, '%3B')
            .replace(/\//g, '%2F')
            .replace(/\?/g, '%3F')
            .replace(/:/g, '%3A')
            .replace(/@/g, '%40')
            .replace(/=/g, '%3D')
            .replace(/&/g, '%26')
            .replace(/\$/g, '%24')
            .replace(/,/g, '%2C')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/!/g, '%21')
            .replace(/~/g, '%7E')
            .replace(/\*/g, '%2A')
            // 移除對 . 和 - 的編碼，讓它們保持原樣
            // .replace(/\./g, '%2E')
            // .replace(/_/g, '%5F')
            // .replace(/-/g, '%2D')
}

// 綠界官方正確的 CheckMacValue 驗證方式
function verifyCheckMacValue(params: Record<string, string>): boolean {
  const receivedCheckMacValue = params.CheckMacValue
  delete params.CheckMacValue

  // 重新產生檢查碼
  const sortedKeys = Object.keys(params).sort()
  let queryString = ''
  
  for (const key of sortedKeys) {
    if (params[key] !== '' && params[key] !== null && params[key] !== undefined) {
      queryString += `${key}=${params[key]}&`
    }
  }
  
  // 移除最後一個 & 符號
  queryString = queryString.slice(0, -1)
  
  // 最前面加上 HashKey，最後面加上 HashIV（綠界官方正確方式）
  const withKeys = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${queryString}&HashIV=${ECPAY_CONFIG.HASH_IV}`
  
  // 進行 URL encode（使用舊版標準，空格編碼為 +）
  const urlEncoded = customUrlEncode(withKeys)
  
  // 轉為小寫
  const lowerCase = urlEncoded.toLowerCase()
  
  // 使用 SHA256 加密
  const hash = crypto.createHash('sha256').update(lowerCase).digest('hex')
  const calculatedCheckMacValue = hash.toUpperCase()

  return calculatedCheckMacValue === receivedCheckMacValue
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const paymentStatus = formData.get('PaymentStatus')
    const orderNumber = formData.get('MerchantTradeNo')
    const amount = formData.get('TradeAmt')
    const paymentDate = formData.get('PaymentDate')
    const paymentType = formData.get('PaymentType')
    const paymentTypeChargeFee = formData.get('PaymentTypeChargeFee')
    const simulatePaid = formData.get('SimulatePaid')

    console.log('付款回調收到:', {
      paymentStatus,
      orderNumber,
      amount,
      paymentDate,
      paymentType,
      paymentTypeChargeFee,
      simulatePaid
    })

    // 檢查是否為儲值訂單
    if (orderNumber && orderNumber.toString().startsWith('RECHARGE-')) {
      return await handleRechargeCallback(formData)
    }

    // 原有的預約付款邏輯
    if (!orderNumber) {
      return NextResponse.json({ error: '缺少訂單號碼' }, { status: 400 })
    }

    // 查找預約
    const booking = await prisma.booking.findFirst({
      where: { orderNumber: orderNumber.toString() }
    })

    if (!booking) {
      console.error('找不到預約:', orderNumber)
      return NextResponse.json({ error: '找不到預約' }, { status: 404 })
    }

    if (paymentStatus === 'SUCCESS' || simulatePaid === 'Y') {
      // 付款成功
      const expectedAmount = booking.finalAmount
      const actualAmount = parseInt(amount?.toString() || '0')

      if (actualAmount !== expectedAmount) {
        console.warn(`金額不匹配: 期望 ${expectedAmount}, 實際 ${actualAmount}`)
      }

      // 更新預約狀態
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'PAID_WAITING_PARTNER_CONFIRMATION',
          paymentInfo: {
            ...booking.paymentInfo,
            paymentStatus: 'SUCCESS',
            paymentDate: paymentDate?.toString(),
            paymentType: paymentType?.toString(),
            paymentTypeChargeFee: paymentTypeChargeFee?.toString(),
            actualAmount: actualAmount,
            expectedAmount: expectedAmount
          }
        }
      })

      console.log('預約付款成功:', booking.id)

      // 發送通知
      try {
        await sendNotification('PAYMENT_SUCCESS', {
          bookingId: booking.id,
          orderNumber: orderNumber.toString(),
          amount: actualAmount
        })
      } catch (error) {
        console.error('發送付款成功通知失敗:', error)
      }

      return NextResponse.json({ success: true, message: '付款成功' })
    } else {
      // 付款失敗
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'PENDING_PAYMENT',
          paymentInfo: {
            ...booking.paymentInfo,
            paymentStatus: 'FAILED',
            paymentDate: paymentDate?.toString(),
            paymentType: paymentType?.toString(),
            failureReason: '付款失敗'
          }
        }
      })

      console.log('預約付款失敗:', booking.id)

      // 發送通知
      try {
        await sendNotification('PAYMENT_FAILED', {
          bookingId: booking.id,
          orderNumber: orderNumber.toString(),
          amount: amount?.toString()
        })
      } catch (error) {
        console.error('發送付款失敗通知失敗:', error)
      }

      return NextResponse.json({ success: false, message: '付款失敗' })
    }

  } catch (error) {
    console.error('處理付款回調失敗:', error)
    return NextResponse.json({ error: '處理付款回調失敗' }, { status: 500 })
  }
}

// 處理儲值回調
async function handleRechargeCallback(formData: FormData) {
  try {
    const paymentStatus = formData.get('PaymentStatus')
    const orderNumber = formData.get('MerchantTradeNo')
    const amount = formData.get('TradeAmt')
    const paymentDate = formData.get('PaymentDate')
    const paymentType = formData.get('PaymentType')
    const simulatePaid = formData.get('SimulatePaid')

    if (!orderNumber) {
      return NextResponse.json({ error: '缺少訂單號碼' }, { status: 400 })
    }

    // 查找儲值記錄
    const rechargeRecord = await prisma.rechargeRecord.findUnique({
      where: { orderNumber: orderNumber.toString() }
    })

    if (!rechargeRecord) {
      console.error('找不到儲值記錄:', orderNumber)
      return NextResponse.json({ error: '找不到儲值記錄' }, { status: 404 })
    }

    if (paymentStatus === 'SUCCESS' || simulatePaid === 'Y') {
      // 付款成功，增加用戶金幣
      const result = await prisma.$transaction(async (tx) => {
        // 更新儲值記錄狀態
        await tx.rechargeRecord.update({
          where: { id: rechargeRecord.id },
          data: { status: 'SUCCESS' }
        })

        // 增加用戶金幣餘額
        const updatedCoins = await tx.userCoins.upsert({
          where: { userId: rechargeRecord.userId },
          update: {
            coinBalance: { increment: rechargeRecord.coinAmount },
            totalRecharged: { increment: rechargeRecord.coinAmount }
          },
          create: {
            userId: rechargeRecord.userId,
            coinBalance: rechargeRecord.coinAmount,
            totalRecharged: rechargeRecord.coinAmount
          }
        })

        // 記錄交易
        await tx.coinTransaction.create({
          data: {
            userId: rechargeRecord.userId,
            transactionType: 'RECHARGE',
            amount: rechargeRecord.coinAmount,
            description: `儲值 ${rechargeRecord.coinAmount} 金幣`,
            balanceBefore: updatedCoins.coinBalance - rechargeRecord.coinAmount,
            balanceAfter: updatedCoins.coinBalance
          }
        })

        return updatedCoins
      })

      console.log('儲值成功:', {
        userId: rechargeRecord.userId,
        coins: rechargeRecord.coinAmount,
        newBalance: result.coinBalance
      })

      return NextResponse.json({ 
        success: true, 
        message: '儲值成功',
        coins: rechargeRecord.coinAmount,
        newBalance: result.coinBalance
      })
    } else {
      // 付款失敗
      await prisma.rechargeRecord.update({
        where: { id: rechargeRecord.id },
        data: { status: 'FAILED' }
      })

      console.log('儲值付款失敗:', rechargeRecord.id)
      return NextResponse.json({ success: false, message: '儲值付款失敗' })
    }

  } catch (error) {
    console.error('處理儲值回調失敗:', error)
    return NextResponse.json({ error: '處理儲值回調失敗' }, { status: 500 })
  }
} 