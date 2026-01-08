'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface OrderRecord {
  date: string
  time: string
  duration: number
  partnerDiscord: string
  partnerName: string
  customerName: string
  serviceType: string
  amount: number
  timestamp: Date
}

interface GroupedData {
  [month: string]: {
    [partnerName: string]: OrderRecord[]
  }
}

interface PlatformRevenue {
  total: {
    totalAmount: number
    basePlatformFee: number
    referralExpense: number
    firstPlaceDiscount: number
    platformRevenue: number
  }
  monthly: Record<string, {
    totalAmount: number
    basePlatformFee: number
    referralExpense: number
    firstPlaceDiscount: number
    platformRevenue: number
  }>
  details: {
    firstPlaceBookingsCount: number
  }
}

export default function AdminOrderRecordsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [data, setData] = useState<GroupedData>({})
  const [platformRevenue, setPlatformRevenue] = useState<PlatformRevenue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'ADMIN') {
      router.replace('/')
      return
    }
    fetchData()
  }, [session, status, router, selectedMonth])

  const fetchData = async () => {
    try {
      setLoading(true)
      const url = selectedMonth 
        ? `/api/admin/order-records?month=${selectedMonth}`
        : '/api/admin/order-records'
      const response = await fetch(url)
      if (response.ok) {
        const result = await response.json()
        setData(result.data || {})
      } else {
        setError('獲取訂單記錄失敗')
      }

      // 获取平台总收入
      const revenueUrl = selectedMonth
        ? `/api/admin/platform-revenue?month=${selectedMonth}`
        : '/api/admin/platform-revenue'
      const revenueResponse = await fetch(revenueUrl)
      if (revenueResponse.ok) {
        const revenueResult = await revenueResponse.json()
        setPlatformRevenue(revenueResult)
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError('獲取訂單記錄失敗')
    } finally {
      setLoading(false)
    }
  }

  // 獲取所有可用的月份
  const availableMonths = Object.keys(data).sort().reverse()

  // 計算每個夥伴的總金額（四捨五入）
  const calculatePartnerTotal = (records: OrderRecord[]) => {
    return Math.round(records.reduce((sum, record) => sum + record.amount, 0))
  }

  // 計算每個月的總金額（四捨五入）
  const calculateMonthTotal = (monthData: { [partnerName: string]: OrderRecord[] }) => {
    let total = 0
    for (const partnerName in monthData) {
      total += calculatePartnerTotal(monthData[partnerName])
    }
    return Math.round(total)
  }

  // 計算所有月份的總金額（四捨五入）
  const calculateGrandTotal = () => {
    let total = 0
    for (const month in data) {
      total += calculateMonthTotal(data[month])
    }
    return Math.round(total)
  }

  // 匯出 Excel
  const handleExportExcel = async () => {
    try {
      const url = selectedMonth
        ? `/api/admin/order-records/export?month=${selectedMonth}`
        : '/api/admin/order-records/export'
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('匯出失敗')
      }

      // 獲取文件名
      const contentDisposition = response.headers.get('Content-Disposition')
      let fileName = '訂單記錄.xlsx'
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = decodeURIComponent(fileNameMatch[1].replace(/['"]/g, ''))
        }
      }

      // 下載文件
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('匯出 Excel 失敗:', error)
      alert('匯出 Excel 失敗，請稍後再試')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700">載入中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-gray-900 text-2xl font-bold mb-2">載入失敗</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 標題和月份選擇 */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-gray-900 mb-4 sm:mb-0">訂單記錄</h1>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm font-medium text-gray-700">選擇月份：</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部月份</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              刷新
            </button>
            <button
              onClick={handleExportExcel}
              disabled={availableMonths.length === 0}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              匯出 Excel
            </button>
          </div>
        </div>

        {/* 總計卡片 */}
        {!selectedMonth && (
          <div className="mb-6 space-y-4">
            <div className="bg-red-500 text-white p-4 rounded-lg shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">總計（所有月份）</span>
                <span className="text-2xl font-bold">NT$ {calculateGrandTotal().toLocaleString()}</span>
              </div>
            </div>
            
            {/* 平台总收入 */}
            {platformRevenue && (
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-lg shadow-lg">
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-2">💰 平台總收入（所有月份）</h3>
                  <div className="text-3xl font-bold">NT$ {Math.round(platformRevenue.total.platformRevenue).toLocaleString()}</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-white/80">基礎平台抽成 (15%)</div>
                    <div className="font-semibold">NT$ {Math.round(platformRevenue.total.basePlatformFee).toLocaleString()}</div>
                  </div>
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-white/80">推薦獎勵支出</div>
                    <div className="font-semibold text-red-200">-NT$ {Math.round(platformRevenue.total.referralExpense).toLocaleString()}</div>
                  </div>
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-white/80">第一名減免 (2%)</div>
                    <div className="font-semibold text-yellow-200">-NT$ {Math.round(platformRevenue.total.firstPlaceDiscount).toLocaleString()}</div>
                  </div>
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-white/80">總訂單金額</div>
                    <div className="font-semibold">NT$ {Math.round(platformRevenue.total.totalAmount).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 按月份顯示數據 */}
        {Object.keys(data).length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">目前沒有訂單記錄</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(data)
              .sort(([a], [b]) => b.localeCompare(a)) // 最新的月份在前
              .map(([month, monthData]) => {
                const monthTotal = calculateMonthTotal(monthData)
                const sortedPartners = Object.keys(monthData).sort()

                return (
                  <div key={month} className="bg-white rounded-lg shadow-lg overflow-hidden">
                    {/* 月份標題 */}
                    <div className="bg-blue-500 text-white px-6 py-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">{month} 月</h2>
                        <span className="text-lg font-semibold">
                          總計：NT$ {monthTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* 該月的平台总收入 */}
                    {platformRevenue?.monthly[month] && (
                      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-6 py-4 border-b border-purple-400">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-bold">💰 平台總收入</h3>
                          <span className="text-2xl font-bold">
                            NT$ {Math.round(platformRevenue.monthly[month].platformRevenue).toLocaleString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-3">
                          <div className="bg-white/10 rounded p-2">
                            <div className="text-white/80">基礎平台抽成 (15%)</div>
                            <div className="font-semibold">NT$ {Math.round(platformRevenue.monthly[month].basePlatformFee).toLocaleString()}</div>
                          </div>
                          <div className="bg-white/10 rounded p-2">
                            <div className="text-white/80">推薦獎勵支出</div>
                            <div className="font-semibold text-red-200">-NT$ {Math.round(platformRevenue.monthly[month].referralExpense).toLocaleString()}</div>
                          </div>
                          <div className="bg-white/10 rounded p-2">
                            <div className="text-white/80">第一名減免 (2%)</div>
                            <div className="font-semibold text-yellow-200">-NT$ {Math.round(platformRevenue.monthly[month].firstPlaceDiscount).toLocaleString()}</div>
                          </div>
                          <div className="bg-white/10 rounded p-2">
                            <div className="text-white/80">該月總金額</div>
                            <div className="font-semibold">NT$ {Math.round(platformRevenue.monthly[month].totalAmount).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 按夥伴分組顯示 */}
                    <div className="divide-y divide-gray-200">
                      {sortedPartners.map((partnerName) => {
                        const partnerRecords = monthData[partnerName]
                        const partnerTotal = calculatePartnerTotal(partnerRecords)

                        return (
                          <div key={partnerName} className="p-6">
                            {/* 夥伴標題 */}
                            <div className="mb-4 flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {partnerName}
                              </h3>
                              <span className="text-lg font-bold text-blue-600">
                                小計：NT$ {partnerTotal.toLocaleString()}
                              </span>
                            </div>

                            {/* 訂單記錄表格 */}
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      日期
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      時間
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      時長（分鐘）
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      顧客
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      服務款項
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      訂單金額
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {partnerRecords.map((record, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {record.date}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {record.time}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {record.duration}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {record.customerName}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {record.serviceType || '一般預約'}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                        NT$ {Math.round(record.amount).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}

