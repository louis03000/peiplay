'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface SuspiciousTransaction {
  bookingId: string
  partnerName: string
  customerName: string
  amount: number
  createdAt: string
  riskScore: number
  reasons: string[]
}

interface Summary {
  totalTransactions: number
  totalAmount: number
  suspiciousCount: number
  highRiskCount: number
  riskRate: string
}

export default function AntiMoneyLaunderingPage() {
  const { data: session } = useSession()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [suspiciousTransactions, setSuspiciousTransactions] = useState<SuspiciousTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [days, setDays] = useState(7)

  useEffect(() => {
    if (session?.user?.id) {
      fetchData()
    }
  }, [session, days])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/anti-money-laundering?days=${days}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '獲取數據失敗')
      }
      
      setSummary(data.summary)
      setSuspiciousTransactions(data.suspiciousTransactions)
    } catch (err) {
      setError(err instanceof Error ? err.message : '獲取數據失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleTransactionAction = async (bookingId: string, action: 'BLOCK' | 'ALLOW', reason?: string) => {
    try {
      const response = await fetch('/api/admin/anti-money-laundering', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId,
          action,
          reason: reason || '管理員手動操作'
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '操作失敗')
      }
      
      // 重新獲取數據
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗')
    }
  }

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">請先登入</h2>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">載入中...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">反洗錢監控系統</h1>
          <p className="mt-2 text-gray-600">監控可疑交易模式，防制洗錢活動</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* 篩選器 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            監控時間範圍
          </label>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value={1}>最近1天</option>
            <option value={7}>最近7天</option>
            <option value={30}>最近30天</option>
            <option value={90}>最近90天</option>
          </select>
        </div>

        {/* 統計摘要 */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">總交易數</h3>
              <p className="text-3xl font-bold text-blue-600">{summary.totalTransactions}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">總金額</h3>
              <p className="text-3xl font-bold text-green-600">${summary.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">可疑交易</h3>
              <p className="text-3xl font-bold text-yellow-600">{summary.suspiciousCount}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">高風險交易</h3>
              <p className="text-3xl font-bold text-red-600">{summary.highRiskCount}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">風險率</h3>
              <p className="text-3xl font-bold text-orange-600">{summary.riskRate}%</p>
            </div>
          </div>
        )}

        {/* 可疑交易列表 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">可疑交易列表</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    交易ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    夥伴
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    客戶
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    金額
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    風險分數
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suspiciousTransactions.map((transaction) => (
                  <tr key={transaction.bookingId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transaction.bookingId.slice(-8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.partnerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.customerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${transaction.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.riskScore >= 70 
                          ? 'bg-red-100 text-red-800' 
                          : transaction.riskScore >= 50 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {transaction.riskScore}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transaction.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleTransactionAction(transaction.bookingId, 'ALLOW')}
                          className="text-green-600 hover:text-green-900"
                        >
                          放行
                        </button>
                        <button
                          onClick={() => handleTransactionAction(transaction.bookingId, 'BLOCK')}
                          className="text-red-600 hover:text-red-900"
                        >
                          封鎖
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {suspiciousTransactions.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              沒有發現可疑交易
            </div>
          )}
        </div>

        {/* 風險原因說明 */}
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">風險檢測規則</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">高頻交易</h4>
              <p className="text-sm text-gray-600">
                24小時內超過10筆交易，風險分數+50
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">異常金額</h4>
              <p className="text-sm text-gray-600">
                交易金額在1,000-50,000元之間，風險分數+30
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">重複客戶</h4>
              <p className="text-sm text-gray-600">
                同一客戶24小時內超過5筆交易，風險分數+40
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 