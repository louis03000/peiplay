'use client'
import { useState } from 'react'

interface ReviewFormProps {
  bookingId: string
  revieweeId: string
  onSuccess?: () => void
}

export default function ReviewForm({ bookingId, revieweeId, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, revieweeId, rating, comment }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || '送出失敗')
      }
      
      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '送出失敗')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-green-600 bg-green-50 p-4 rounded-lg">
        感謝您的評價！
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          評分
        </label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} 星
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          留言
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="分享您的體驗..."
        />
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? '送出中...' : '送出評價'}
      </button>
    </form>
  )
} 