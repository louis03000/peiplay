"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import ReviewForm from './ReviewForm'

interface Booking {
  id: string
  status: string
  schedule: {
    date: string
    startTime: string
    endTime: string
    partner: {
      id: string
      name: string
      userId: string
    }
  }
  reviews: Array<{
    id: string
    reviewerId: string
  }>
}

export default function MyBookings() {
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined };
  const session = sessionData.data;
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showReviewForm, setShowReviewForm] = useState(false)

  useEffect(() => {
    fetch("/api/bookings").then(res => res.json()).then(data => setBookings(data.bookings || []))
  }, [])

  const handleReviewSuccess = () => {
    setShowReviewForm(false)
    setSelectedBooking(null)
    // 重新載入預約列表
    fetch("/api/bookings").then(res => res.json()).then(data => setBookings(data.bookings || []))
  }

  const canReview = (booking: Booking) => {
    return (
      booking.status === 'COMPLETED' &&
      !booking.reviews.some(review => review.reviewerId === session?.user?.id)
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">我的預約</h2>
      <table className="w-full border">
        <thead>
          <tr>
            <th>預約日期</th>
            <th>時段</th>
            <th>陪玩師</th>
            <th>狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => (
            <tr key={b.id}>
              <td>{b.schedule?.date ? new Date(b.schedule.date).toLocaleDateString() : ''}</td>
              <td>
                {b.schedule?.startTime?.slice(0, 5)}-
                {b.schedule?.endTime?.slice(0, 5)}
              </td>
              <td>{b.schedule?.partner?.name || 'N/A'}</td>
              <td>{b.status}</td>
              <td>
                {canReview(b) && (
                  <button
                    onClick={() => {
                      setSelectedBooking(b)
                      setShowReviewForm(true)
                    }}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    評價
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showReviewForm && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">
              評價 {selectedBooking.schedule.partner.name}
            </h3>
            <ReviewForm
              bookingId={selectedBooking.id}
              revieweeId={selectedBooking.schedule.partner.userId}
              onSuccess={handleReviewSuccess}
            />
            <button
              onClick={() => {
                setShowReviewForm(false)
                setSelectedBooking(null)
              }}
              className="mt-4 w-full text-gray-600 hover:text-gray-900"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 