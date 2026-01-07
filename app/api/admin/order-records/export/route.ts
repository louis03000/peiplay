import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import * as ExcelJS from 'exceljs'

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

    // 查詢訂單記錄
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

    // 處理記錄
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
      const twDate = new Date(createdAt.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
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
        orderAmount = Math.round((durationMinutes / 30) * parseFloat(halfHourlyRate.toString()))
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

    // 按月份和夥伴分組
    const recordsByMonth: Record<string, Record<string, typeof processedRecords>> = {}
    for (const record of processedRecords) {
      const monthKey = record.date.substring(0, 7) // YYYY-MM
      if (!recordsByMonth[monthKey]) {
        recordsByMonth[monthKey] = {}
      }
      if (!recordsByMonth[monthKey][record.partnerName]) {
        recordsByMonth[monthKey][record.partnerName] = []
      }
      recordsByMonth[monthKey][record.partnerName].push(record)
    }

    // 創建 Excel 工作簿
    const workbook = new ExcelJS.Workbook()

    // 如果指定了月份，只導出該月份；否則導出所有月份
    const monthsToExport = filterMonth 
      ? [filterMonth] 
      : Object.keys(recordsByMonth).sort()

    for (const month of monthsToExport) {
      const monthData = recordsByMonth[month]
      if (!monthData) continue

      // 為每個月份創建一個工作表
      const sheet = workbook.addWorksheet(`${month}月`)
      
      // 設置列標題
      sheet.columns = [
        { header: '日期', key: 'date', width: 12 },
        { header: '時間', key: 'time', width: 10 },
        { header: '時長（分鐘）', key: 'duration', width: 12 },
        { header: '夥伴', key: 'partnerName', width: 15 },
        { header: '顧客', key: 'customerName', width: 15 },
        { header: '服務款項', key: 'serviceType', width: 12 },
        { header: '訂單金額', key: 'amount', width: 12 },
      ]

      // 按夥伴名稱排序
      const sortedPartners = Object.keys(monthData).sort()

      // 添加數據行
      let monthTotal = 0
      for (const partnerName of sortedPartners) {
        const partnerRecords = monthData[partnerName]
        const partnerTotal = Math.round(partnerRecords.reduce((sum, r) => sum + r.amount, 0))
        monthTotal += partnerTotal

        // 添加夥伴標題行
        sheet.addRow({
          date: `${partnerName} - 小計`,
          time: '',
          duration: '',
          partnerName: '',
          customerName: '',
          serviceType: '',
          amount: partnerTotal,
        })

        // 添加該夥伴的所有記錄
        for (const record of partnerRecords) {
          sheet.addRow({
            date: record.date,
            time: record.time,
            duration: record.duration,
            partnerName: record.partnerName,
            customerName: record.customerName,
            serviceType: record.serviceType,
            amount: record.amount,
          })
        }

        // 添加空行分隔
        sheet.addRow({})
      }

      // 添加月份總計行
      sheet.addRow({
        date: `${month}月 - 總計`,
        time: '',
        duration: '',
        partnerName: '',
        customerName: '',
        serviceType: '',
        amount: monthTotal,
      })

      // 設置標題行樣式
      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF366092' },
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

      // 設置小計和總計行樣式
      for (let i = 1; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i)
        const dateCell = row.getCell(1)
        const dateValue = dateCell.value
        if (dateValue) {
          const dateStr = String(dateValue)
          if (dateStr.includes('小計') || dateStr.includes('總計')) {
            row.font = { bold: true }
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E0E0' },
            }
          }
        }
      }

      // 設置金額列格式
      const amountColumn = sheet.getColumn('amount')
      amountColumn.numFmt = '#,##0'
    }

    // 生成 Excel 文件
    const buffer = await workbook.xlsx.writeBuffer()

    // 生成文件名
    const fileName = filterMonth 
      ? `訂單記錄_${filterMonth}.xlsx`
      : `訂單記錄_全部月份_${new Date().toISOString().split('T')[0]}.xlsx`

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting order records:', error)
    return NextResponse.json(
      { error: 'Failed to export order records' },
      { status: 500 }
    )
  }
}
