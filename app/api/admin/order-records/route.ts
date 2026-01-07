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

    // 🔥 直接從 Booking 表查詢，而不是只依賴 PairingRecord
    // 這樣可以確保所有預約都被包含，即使沒有 PairingRecord
    const bookings = await db.query(async (client) => {
      return await client.booking.findMany({
        where: {
          status: {
            in: ['CONFIRMED', 'COMPLETED', 'PARTNER_ACCEPTED']
          }
        },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  discord: true,
                  name: true
                }
              }
            }
          },
          schedule: {
            include: {
              partner: {
                include: {
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
        },
        orderBy: {
          createdAt: 'asc'
        }
      })
    })

    // 處理記錄，獲取正確的夥伴和顧客信息
    const processedRecords = []
    
    for (const booking of bookings) {
      let partnerDiscord = booking.schedule?.partner?.user?.discord || ''
      let customerDiscord = booking.customer?.user?.discord || ''
      let partnerName = booking.schedule?.partner?.user?.name || ''
      let customerName = booking.customer?.user?.name || ''
      let finalAmount: number | null = booking.finalAmount
      let halfHourlyRate: number | null = booking.schedule?.partner?.halfHourlyRate || null

      // 如果沒有獲取到，跳過此記錄
      if (!partnerDiscord || !customerDiscord) {
        continue
      }

      // 判斷服務類型
      let serviceType = '一般預約'
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

      // 轉換時間為台灣時間
      const createdAt = new Date(booking.createdAt)
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
      const startTime = new Date(booking.schedule.startTime)
      const endTime = new Date(booking.schedule.endTime)
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))

      // 計算訂單金額（四捨五入）
      let orderAmount = 0
      if (finalAmount !== null && finalAmount !== undefined) {
        orderAmount = Math.round(parseFloat(finalAmount.toString()))
      } else if (halfHourlyRate !== null && halfHourlyRate !== undefined && durationMinutes > 0) {
        // 如果沒有 finalAmount，根據時長和費率計算
        orderAmount = Math.round((durationMinutes / 30) * parseFloat(halfHourlyRate.toString()))
      }
      
      // 🔥 如果金額還是0，記錄警告但不跳過（可能是免費預約或測試）
      if (orderAmount === 0 && finalAmount === null && halfHourlyRate === null) {
        console.warn(`⚠️ 預約 ${booking.id} 沒有金額信息：finalAmount=${finalAmount}, halfHourlyRate=${halfHourlyRate}`)
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
    
    console.log(`✅ 處理了 ${processedRecords.length} 條訂單記錄（從 ${bookings.length} 個預約中）`)

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

