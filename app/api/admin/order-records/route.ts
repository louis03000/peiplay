import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    // 檢查是否為管理員
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filterMonth = searchParams.get('month') // 格式：YYYY-MM

    // 獲取所有配對記錄
    const records = await db.query(async (client) => {
      return await client.pairingRecord.findMany({
        orderBy: {
          createdAt: 'asc'
        }
      })
    })

    // 處理記錄，獲取正確的夥伴和顧客信息
    const processedRecords = []
    
    for (const record of records) {
      const bookingId = record.bookingId
      let partnerDiscord = ''
      let customerDiscord = ''
      let partnerName = ''
      let customerName = ''
      let finalAmount: number | null = null
      let halfHourlyRate: number | null = null

      // 如果有 bookingId 且不是 manual_ 前綴，從 Booking 獲取正確的用戶信息
      let serviceType = '一般預約'
      if (bookingId && !bookingId.startsWith('manual_')) {
        const booking = await db.query(async (client) => {
          return await client.booking.findUnique({
            where: { id: bookingId },
            select: {
              finalAmount: true,
              paymentInfo: true,
              groupBookingId: true,
              multiPlayerBookingId: true,
              serviceType: true,
              customer: {
                select: {
                  user: {
                    select: {
                      discord: true,
                      name: true
                    }
                  }
                }
              },
              schedule: {
                select: {
                  partner: {
                    select: {
                      halfHourlyRate: true,
                      user: {
                        select: {
                          discord: true,
                          name: true
                        }
                      }
                    }
                  }
                }
              }
            }
          })
        })

        if (booking) {
          partnerDiscord = booking.schedule?.partner?.user?.discord || ''
          partnerName = booking.schedule?.partner?.user?.name || ''
          customerDiscord = booking.customer?.user?.discord || ''
          customerName = booking.customer?.user?.name || ''
          finalAmount = booking.finalAmount
          halfHourlyRate = booking.schedule?.partner?.halfHourlyRate || null
          
          // 判斷服務類型
          const paymentInfo = booking.paymentInfo as any
          if (paymentInfo?.isInstantBooking === true || paymentInfo?.isInstantBooking === 'true') {
            serviceType = '即時預約'
          } else if (booking.groupBookingId) {
            serviceType = '群組預約'
          } else if (booking.multiPlayerBookingId) {
            serviceType = '多人陪玩'
          } else if (booking.serviceType === 'CHAT_ONLY') {
            serviceType = '純聊天'
          }
        }
      }

      // 如果沒有獲取到，跳過此記錄
      if (!partnerDiscord || !customerDiscord) {
        continue
      }

      // 轉換時間為台灣時間
      const createdAt = new Date(record.createdAt)
      // 使用正確的時區轉換
      const twDate = new Date(createdAt.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
      // 獲取台灣時間的日期和時間字符串
      const year = twDate.getFullYear()
      const month = String(twDate.getMonth() + 1).padStart(2, '0')
      const day = String(twDate.getDate()).padStart(2, '0')
      const hours = String(twDate.getHours()).padStart(2, '0')
      const minutes = String(twDate.getMinutes()).padStart(2, '0')
      const seconds = String(twDate.getSeconds()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      const timeStr = `${hours}:${minutes}:${seconds}`

      // 如果指定了月份，過濾記錄
      if (filterMonth && !dateStr.startsWith(filterMonth)) {
        continue
      }

      // 計算時長（分鐘）
      const durationMinutes = Math.floor(record.duration / 60)

      // 計算訂單金額
      let orderAmount = 0
      if (finalAmount) {
        orderAmount = parseFloat(finalAmount.toString())
      } else if (halfHourlyRate && durationMinutes) {
        orderAmount = (durationMinutes / 30) * parseFloat(halfHourlyRate.toString())
      }

      processedRecords.push({
        date: dateStr,
        time: timeStr,
        duration: durationMinutes,
        partnerDiscord,
        partnerName,
        customerName,
        serviceType,
        amount: orderAmount,
        timestamp: createdAt
      })
    }

    // 按月份分組
    const recordsByMonth: Record<string, typeof processedRecords> = {}
    for (const record of processedRecords) {
      const monthKey = record.date.substring(0, 7) // YYYY-MM
      if (!recordsByMonth[monthKey]) {
        recordsByMonth[monthKey] = []
      }
      recordsByMonth[monthKey].push(record)
    }

    // 按夥伴分組（在每個月內）
    const groupedData: Record<string, Record<string, typeof processedRecords>> = {}
    for (const [monthKey, records] of Object.entries(recordsByMonth)) {
      // 先按夥伴名稱分組
      const byPartner: Record<string, typeof processedRecords> = {}
      for (const record of records) {
        const partnerKey = record.partnerName
        if (!byPartner[partnerKey]) {
          byPartner[partnerKey] = []
        }
        byPartner[partnerKey].push(record)
      }

      // 在每個夥伴組內按時間排序
      for (const partnerKey in byPartner) {
        byPartner[partnerKey].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      }

      groupedData[monthKey] = byPartner
    }

    return NextResponse.json({ data: groupedData })
  } catch (error) {
    console.error('Error fetching order records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order records' },
      { status: 500 }
    )
  }
}

