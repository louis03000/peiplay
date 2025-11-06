'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import PartnerPageLayout from '@/components/partner/PartnerPageLayout'
import InfoCard from '@/components/partner/InfoCard'
import SectionTitle from '@/components/partner/SectionTitle'
import StatBox from '@/components/partner/StatBox'

interface WithdrawalStats {
  totalEarnings: number
  totalOrders: number
  availableBalance: number
  pendingWithdrawals: number
  referralEarnings: number
}

interface WithdrawalHistory {
  id: string
  amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  requestedAt: string
  processedAt?: string
  adminNote?: string
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

    try {
      setSubmitting(true)
      setError('')

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
    <PartnerPageLayout
      title="申請提領"
      subtitle="申請提領您的收入，管理員將審核後處理"
      maxWidth="7xl"
    >
      {/* 成功提示 */}
      {showSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-4">
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
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4">
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
          <StatBox
            label="總收入"
            value={`NT$ ${stats.totalEarnings.toLocaleString()}`}
            iconBgColor="green"
            icon={
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            }
          />
          <StatBox
            label="總接單數"
            value={`${stats.totalOrders} 筆`}
            iconBgColor="blue"
            icon={
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
          <StatBox
            label="可提領餘額"
            value={`NT$ ${stats.availableBalance.toLocaleString()}`}
            iconBgColor="purple"
            subtitle={stats?.referralEarnings > 0 ? `含推薦收入 NT$ ${stats.referralEarnings.toLocaleString()}` : undefined}
            icon={
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            }
          />
          <StatBox
            label="待審核"
            value={`${stats.pendingWithdrawals} 筆`}
            iconBgColor="yellow"
            icon={
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* 提領申請表單 */}
        <InfoCard>
          <SectionTitle title="申請提領" />
          <div>
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
                    placeholder="請輸入提領金額"
                    min="100"
                    max={stats?.availableBalance || 0}
                    step="1"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-[#6C63FF] text-gray-900 placeholder-gray-500"
                    style={{ color: '#111827' }}
                    required
                  />
                  {stats && (
                    <p className="mt-1 text-sm text-gray-500">
                      可提領餘額：NT$ {stats.availableBalance.toLocaleString()}
                    </p>
                  )}
                  {withdrawalAmount && parseFloat(withdrawalAmount) < 100 && (
                    <p className="mt-1 text-sm text-red-500">
                      最小提領金額為 NT$ 100
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-800">
                          <strong>注意事項：</strong>
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
                  <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
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
                          <br />• 平台維護費：15%
                          <br />• 轉帳手續費：NT$ 15
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !withdrawalAmount || parseFloat(withdrawalAmount) < 100}
                  className="w-full bg-[#6C63FF] text-white py-2.5 px-4 rounded-2xl hover:bg-[#5a52e6] focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {submitting ? '提交中...' : '提交提領申請'}
                </button>
              </form>
          </div>
        </InfoCard>

        {/* 提領歷史 */}
        <InfoCard>
          <SectionTitle title="提領歷史" />
          <div>
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
                    <div key={withdrawal.id} className="border border-gray-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-semibold text-gray-900">
                            NT$ {withdrawal.amount.toLocaleString()}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(withdrawal.status)}`}>
                            {getStatusText(withdrawal.status)}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(withdrawal.requestedAt).toLocaleDateString('zh-TW')}
                        </span>
                      </div>
                      {withdrawal.adminNote && (
                        <p className="text-sm text-gray-600 mt-2">
                          <strong>管理員備註：</strong>{withdrawal.adminNote}
                        </p>
                      )}
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
        </InfoCard>
      </div>
    </PartnerPageLayout>
  )
}
