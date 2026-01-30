'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface WithdrawalStats {
  totalEarnings: number
  totalOrders: number
  availableBalance: number
  pendingWithdrawals: number
  referralEarnings: number
  platformFeePercentage?: number
  rank?: number | null
}

interface WithdrawalHistory {
  id: string
  amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  requestedAt: string
  processedAt?: string
  adminNote?: string
  rejectionReason?: string
}

// 檢查今天是否為可提領日（週一或週四）
const isWithdrawalDay = () => {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=週日, 1=週一, 2=週二, 3=週三, 4=週四, 5=週五, 6=週六
  return dayOfWeek === 1 || dayOfWeek === 4 // 週一或週四
}

// 獲取下一個可提領日
const getNextWithdrawalDay = () => {
  const today = new Date()
  const dayOfWeek = today.getDay()
  
  let daysUntilNext: number
  if (dayOfWeek === 1) {
    // 週一 -> 下一個是週四（3天後）
    daysUntilNext = 3
  } else if (dayOfWeek === 4) {
    // 週四 -> 下一個是週一（4天後）
    daysUntilNext = 4
  } else if (dayOfWeek < 1) {
    // 週日 -> 下一個是週一（1天後）
    daysUntilNext = 1
  } else if (dayOfWeek < 4) {
    // 週二、週三 -> 下一個是週四
    daysUntilNext = 4 - dayOfWeek
  } else {
    // 週五、週六 -> 下一個是週一
    daysUntilNext = 8 - dayOfWeek
  }
  
  const nextDate = new Date(today)
  nextDate.setDate(today.getDate() + daysUntilNext)
  return nextDate
}

export default function WithdrawalPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<WithdrawalStats | null>(null)
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [canWithdraw, setCanWithdraw] = useState(false)
  const [nextWithdrawalDate, setNextWithdrawalDate] = useState<Date | null>(null)

  // 檢查是否為可提領日
  useEffect(() => {
    setCanWithdraw(isWithdrawalDay())
    if (!isWithdrawalDay()) {
      setNextWithdrawalDate(getNextWithdrawalDay())
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetchWithdrawalData()
  }, [session, status])

  const fetchWithdrawalData = async () => {
    try {
      setLoading(true)
      const [statsResponse, historyResponse] = await Promise.all([
        fetch('/api/partners/withdrawal/stats'),
        fetch('/api/partners/withdrawal/history')
      ])

      if (!statsResponse.ok || !historyResponse.ok) {
        throw new Error('獲取提領資料失敗')
      }

      const [statsData, historyData] = await Promise.all([
        statsResponse.json(),
        historyResponse.json()
      ])

      setStats(statsData)
      setWithdrawalHistory(historyData.withdrawals || [])
    } catch (error) {
      console.error('獲取提領資料時發生錯誤:', error)
      setError('獲取提領資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
      setError('請輸入有效的提領金額')
      return
    }

    if (!stats || parseFloat(withdrawalAmount) > stats.availableBalance) {
      setError('提領金額不能超過可用餘額')
      return
    }

    // 顯示確認對話框
    setShowConfirmModal(true)
  }

  const handleConfirmSubmit = async () => {
    if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
      setError('請輸入有效的提領金額')
      setShowConfirmModal(false)
      return
    }

    if (!stats || parseFloat(withdrawalAmount) > stats.availableBalance) {
      setError('提領金額不能超過可用餘額')
      setShowConfirmModal(false)
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setShowConfirmModal(false)

      const response = await fetch('/api/partners/withdrawal/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(withdrawalAmount)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '提領申請失敗')
      }

      setWithdrawalAmount('')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
      
      // 重新獲取資料
      await fetchWithdrawalData()
    } catch (error) {
      console.error('提領申請時發生錯誤:', error)
      setError(error instanceof Error ? error.message : '提領申請失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelSubmit = () => {
    setShowConfirmModal(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED': return 'bg-blue-100 text-blue-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return '審核中'
      case 'APPROVED': return '已核准'
      case 'REJECTED': return '已拒絕'
      case 'COMPLETED': return '已完成'
      default: return status
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">請先登入</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 頁面標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">申請提領</h1>
          <p className="mt-2 text-gray-600">申請提領您的收入，管理員將審核後處理（每週一、四開放申請）</p>
        </div>

        {/* 成功提示 */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  提領申請已提交！管理員將盡快審核您的申請。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 錯誤提示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 統計卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">總收入</p>
                  <p className="text-2xl font-bold text-gray-900" style={{ color: '#111827' }}>NT$ {Math.round(stats.totalEarnings).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">總接單數</p>
                  <p className="text-2xl font-bold text-gray-900" style={{ color: '#111827' }}>{stats.totalOrders} 筆</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">可提領餘額</p>
                  <p className="text-2xl font-bold text-gray-900" style={{ color: '#111827' }}>NT$ {Math.floor(stats.availableBalance).toLocaleString()}</p>
                  {stats?.referralEarnings > 0 && (
                    <p className="text-xs text-green-600">含推薦收入 NT$ {Math.round(stats.referralEarnings).toLocaleString()}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">待審核</p>
                  <p className="text-2xl font-bold text-gray-900" style={{ color: '#111827' }}>{stats.pendingWithdrawals} 筆</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 提領申請表單 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">申請提領</h2>
            </div>
            <div className="p-6">
              {/* 非提領日提示 */}
              {!canWithdraw && nextWithdrawalDate && (
                <div className="mb-6 bg-orange-50 border border-orange-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-orange-800">
                        今日不開放申請提領
                      </p>
                      <p className="text-sm text-orange-700 mt-1">
                        提領申請僅於<strong>每週一、四</strong>開放。
                        <br />
                        下次可申請日期：<strong>{nextWithdrawalDate.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <form onSubmit={handleWithdrawalSubmit}>
                <div className="mb-4">
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                    提領金額 (NT$)
                  </label>
                  <input
                    type="number"
                    id="amount"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder={canWithdraw ? "請輸入提領金額" : "今日不開放提領"}
                    min="100"
                    max={stats?.availableBalance || 0}
                    step="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-gray-900 placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    style={{ color: '#111827' }}
                    required
                    disabled={!canWithdraw}
                  />
                  {stats && (
                    <p className="mt-1 text-sm text-gray-500">
                      可提領餘額：NT$ {Math.floor(stats.availableBalance).toLocaleString()}
                    </p>
                  )}
                  {withdrawalAmount && parseFloat(withdrawalAmount) < 100 && (
                    <p className="mt-1 text-sm text-red-500">
                      最小提領金額為 NT$ 100
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-800">
                          <strong>注意事項：</strong>
                          <br />• 提領申請僅於<strong>每週一、四</strong>開放
                          <br />• 提領申請提交後，管理員將審核您的接單記錄和收入
                          <br />• 審核通過後，款項將在 1-3 個工作天內處理
                          <br />• 如有疑問，請聯繫客服
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 費用說明 */}
                <div className="mb-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-800">
                          <strong>費用說明：</strong>
                          <br />• 最小提領金額：NT$ 100
                          <br />• 平台維護費：{(stats?.platformFeePercentage || 0.15) * 100}%
                          {stats?.rank === 1 && ' (第一名優惠：減免2%)'}
                          {(stats?.rank === 2 || stats?.rank === 3) && ' (第二、三名優惠：減免1%)'}
                          {stats?.rank && stats.rank >= 4 && stats.rank <= 10 && ' (排名4-10名：可申請優惠碼)'}
                          <br />• 轉帳手續費：NT$ 15
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !withdrawalAmount || parseFloat(withdrawalAmount) < 100 || !canWithdraw}
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!canWithdraw ? '今日不開放提領' : submitting ? '提交中...' : '提交提領申請'}
                </button>
              </form>
            </div>
          </div>

          {/* 提領歷史 - 永久保存所有記錄 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">提領歷史</h2>
              {withdrawalHistory.length > 0 && (
                <span className="text-sm text-gray-500">共 {withdrawalHistory.length} 筆記錄</span>
              )}
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto">
              {withdrawalHistory.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500">尚無提領記錄</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {withdrawalHistory.map((withdrawal) => (
                    <div key={withdrawal.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-semibold text-gray-900">
                            NT$ {withdrawal.amount.toLocaleString()}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(withdrawal.status)}`}>
                            {getStatusText(withdrawal.status)}
                          </span>
                          {withdrawal.status === 'REJECTED' && withdrawal.rejectionReason && (
                            <div className="relative group">
                              <button className="text-xs text-red-600 hover:text-red-800 underline ml-2">
                                查看原因
                              </button>
                              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-white border border-gray-300 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                <div className="text-xs font-semibold text-gray-700 mb-1">拒絕原因：</div>
                                <div className="text-sm text-gray-900 whitespace-pre-wrap">{withdrawal.rejectionReason}</div>
                                <div className="absolute bottom-0 left-4 transform translate-y-full">
                                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-300"></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(withdrawal.requestedAt).toLocaleDateString('zh-TW')}
                        </span>
                      </div>
                      {withdrawal.processedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          處理時間：{new Date(withdrawal.processedAt).toLocaleString('zh-TW')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 確認對話框 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                確認提領申請
              </h3>
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">
                  您即將提交以下提領申請：
                </p>
                <div className="bg-gray-50 rounded-md p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">提領金額：</span>
                    <span className="text-lg font-bold text-gray-900">
                      NT$ {parseFloat(withdrawalAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>可提領餘額：</span>
                    <span>NT$ {stats ? Math.floor(stats.availableBalance).toLocaleString() : '0'}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  提交後，管理員將審核您的申請。審核通過後，款項將在 1-3 個工作天內處理。
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancelSubmit}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '提交中...' : '確認提交'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
