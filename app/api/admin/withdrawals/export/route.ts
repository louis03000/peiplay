import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import * as ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const withdrawals = await db.query(async (client) => {
      return client.withdrawalRequest.findMany({
        select: {
          id: true,
          amount: true,
          status: true,
          requestedAt: true,
          processedAt: true,
          adminNote: true,
          rejectionReason: true,
          partner: {
            select: {
              id: true,
              name: true,
              bankCode: true,
              bankAccountNumber: true,
              user: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
      })
    }, 'admin:withdrawals:export')

    // 創建 Excel 工作簿
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('提領記錄')

    // 設置列標題
    sheet.columns = [
      { header: '申請ID', key: 'id', width: 30 },
      { header: '夥伴名稱', key: 'partnerName', width: 20 },
      { header: '夥伴Email', key: 'partnerEmail', width: 30 },
      { header: '銀行代碼', key: 'bankCode', width: 15 },
      { header: '帳戶號碼', key: 'bankAccountNumber', width: 20 },
      { header: '提領金額', key: 'amount', width: 15 },
      { header: '狀態', key: 'status', width: 12 },
      { header: '申請時間', key: 'requestedAt', width: 20 },
      { header: '處理時間', key: 'processedAt', width: 20 },
      { header: '管理員備註', key: 'adminNote', width: 30 },
      { header: '拒絕原因', key: 'rejectionReason', width: 30 },
    ]

    // 狀態映射
    const statusMap: { [key: string]: string } = {
      'PENDING': '待審核',
      'APPROVED': '已核准',
      'REJECTED': '已拒絕',
      'COMPLETED': '已完成',
    }

    // 添加數據行
    for (const withdrawal of withdrawals) {
      const requestedAt = new Date(withdrawal.requestedAt)
      const processedAt = withdrawal.processedAt ? new Date(withdrawal.processedAt) : null

      sheet.addRow({
        id: withdrawal.id,
        partnerName: withdrawal.partner.name,
        partnerEmail: withdrawal.partner.user.email,
        bankCode: withdrawal.partner.bankCode || '未填寫',
        bankAccountNumber: withdrawal.partner.bankAccountNumber || '未填寫',
        amount: withdrawal.amount,
        status: statusMap[withdrawal.status] || withdrawal.status,
        requestedAt: requestedAt.toLocaleString('zh-TW'),
        processedAt: processedAt ? processedAt.toLocaleString('zh-TW') : '-',
        adminNote: withdrawal.adminNote || '-',
        rejectionReason: withdrawal.rejectionReason || '-',
      })
    }

    // 設置標題行樣式
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    // 設置金額列格式
    const amountColumn = sheet.getColumn('amount')
    amountColumn.numFmt = '#,##0'

    // 生成 Excel 文件
    const buffer = await workbook.xlsx.writeBuffer()

    // 生成文件名
    const fileName = `提領記錄_全部_${new Date().toISOString().split('T')[0]}.xlsx`

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting withdrawal records:', error)
    return NextResponse.json(
      { error: 'Failed to export withdrawal records' },
      { status: 500 }
    )
  }
}
