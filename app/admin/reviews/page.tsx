'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Review {
  id: string
  rating: number
  comment: string
  createdAt: string
  isApproved: boolean
  approvedAt?: string
  reviewer: {
    name: string
    email: string
  }
  reviewee: {
    name: string
  }
  booking: {
    schedule: {
      partner: {
        name: string
      }
    }
  }
}

interface GroupBookingReview {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  Customer: {
    user: {
      name: string
      email: string
    }
  }
  GroupBooking: {
    id: string
    title: string | null
    date: Date
    startTime: Date
    endTime: Date
    type: string
  }
}

export default function AdminReviewsPage() {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<Review[]>([])
  const [groupBookingReviews, setGroupBookingReviews] = useState<GroupBookingReview[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'multiplayer'>('general')

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchReviews()
    }
  }, [session])

  const fetchReviews = async () => {
    try {
      // 獲取一般預約的評論
      const reviewsResponse = await fetch('/api/admin/reviews')
      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json()
        setReviews(reviewsData.reviews || [])
      }

      // 獲取多人陪玩和群組預約的評論
      const groupReviewsResponse = await fetch('/api/admin/group-booking-reviews')
      if (groupReviewsResponse.ok) {
        const groupReviewsData = await groupReviewsResponse.json()
        setGroupBookingReviews(groupReviewsData.reviews || [])
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReviewAction = async (reviewId: string, action: 'approve' | 'reject') => {
    setUpdating(reviewId)
    try {
      const response = await fetch('/api/admin/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewId,
          action
        })
      })

      if (response.ok) {
        await fetchReviews() // 重新獲取數據
      }
    } catch (error) {
      console.error('Failed to update review:', error)
    } finally {
      setUpdating(null)
    }
  }

  const handleDeleteGroupBookingReview = async (reviewId: string) => {
    if (!confirm('確定要刪除這條評論嗎？此操作無法復原。')) {
      return
    }

    setUpdating(reviewId)
    try {
      const response = await fetch('/api/admin/group-booking-reviews', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewId
        })
      })

      if (response.ok) {
        await fetchReviews() // 重新獲取數據
        alert('評論已刪除')
      } else {
        const error = await response.json()
        alert(error.error || '刪除失敗')
      }
    } catch (error) {
      console.error('Failed to delete review:', error)
      alert('刪除失敗，請重試')
    } finally {
      setUpdating(null)
    }
  }

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">權限不足</h1>
          <p className="text-gray-600">只有管理員可以訪問此頁面</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">評價審核管理</h1>
          <p className="text-gray-600">管理用戶評價的上架狀態</p>
        </div>

        {/* 標籤切換 */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'general'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              一般預約評論 ({reviews.length})
            </button>
            <button
              onClick={() => setActiveTab('multiplayer')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'multiplayer'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              多人陪玩/群組預約評論 ({groupBookingReviews.length})
            </button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* 一般預約評論 */}
          {activeTab === 'general' && (
            <>
              {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold">
                    {review.reviewer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{review.reviewer.name}</h3>
                    <p className="text-sm text-gray-500">評價 {review.booking.schedule.partner.name}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                      ⭐
                    </span>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-gray-700 bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                  "{review.comment}"
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  提交時間：{new Date(review.createdAt).toLocaleString('zh-TW')}
                  {review.approvedAt && (
                    <span className="ml-4">
                      審核時間：{new Date(review.approvedAt).toLocaleString('zh-TW')}
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  {review.isApproved ? (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        ✅ 已上架
                      </span>
                      <button
                        onClick={() => handleReviewAction(review.id, 'reject')}
                        disabled={updating === review.id}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {updating === review.id ? '處理中...' : '下架'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                        ⏳ 待審核
                      </span>
                      <button
                        onClick={() => handleReviewAction(review.id, 'reject')}
                        disabled={updating === review.id}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                      >
                        {updating === review.id ? '處理中...' : '拒絕'}
                      </button>
                      <button
                        onClick={() => handleReviewAction(review.id, 'approve')}
                        disabled={updating === review.id}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                      >
                        {updating === review.id ? '處理中...' : '上架'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
              ))}

              {reviews.length === 0 && (
                <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">暫無評價</h3>
                  <p className="text-gray-600">目前沒有任何一般預約評價需要審核</p>
                </div>
              )}
            </>
          )}

          {/* 多人陪玩/群組預約評論 */}
          {activeTab === 'multiplayer' && (
            <>
              {groupBookingReviews.map((review) => (
                <div key={review.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
                        {review.Customer.user.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{review.Customer.user.name}</h3>
                        <p className="text-sm text-gray-500">
                          {review.GroupBooking.title || '多人陪玩/群組預約'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(review.GroupBooking.startTime).toLocaleString('zh-TW')} - {new Date(review.GroupBooking.endTime).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                          ⭐
                        </span>
                      ))}
                    </div>
                  </div>

                  {review.comment && (
                    <div className="mb-4">
                      <p className="text-gray-700 bg-gray-50 rounded-lg p-4 border-l-4 border-purple-500">
                        "{review.comment}"
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      提交時間：{new Date(review.createdAt).toLocaleString('zh-TW')}
                    </div>

                    <button
                      onClick={() => handleDeleteGroupBookingReview(review.id)}
                      disabled={updating === review.id}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {updating === review.id ? '處理中...' : '刪除評論'}
                    </button>
                  </div>
                </div>
              ))}

              {groupBookingReviews.length === 0 && (
                <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">暫無評價</h3>
                  <p className="text-gray-600">目前沒有任何多人陪玩或群組預約評價</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
