"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import ReviewForm from './ReviewForm'

interface Booking {
  id: string
  status: string
  createdAt: string;
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
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showReviewForm, setShowReviewForm] = useState(false)

  const fetchBookings = () => {
    setLoading(true);
    fetch("/api/bookings")
      .then(res => {
        if (!res.ok) throw new Error('無法載入預約資料');
        return res.json();
      })
      .then(data => {
        setBookings(data.bookings || []);
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (session) {
      fetchBookings();
    }
  }, [session])

  const handleReviewSuccess = () => {
    setShowReviewForm(false)
    setSelectedBooking(null)
    fetchBookings(); // Re-fetch bookings to update review status
  }

  const canReview = (booking: Booking) => {
    if (!session?.user?.id) return false;
    return (
      booking.status === 'COMPLETED' &&
      !booking.reviews.some(review => review.reviewerId === session.user.id)
    )
  }

  // 合併連續時段的預約
  function getTimeHM(dateStr: string) {
    const d = new Date(dateStr);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }
  function mergeBookings(bookings: Booking[]) {
    if (!bookings.length) return [];
    const sorted = [...bookings].sort((a, b) => {
      const d1 = new Date(a.schedule.date).getTime();
      const d2 = new Date(b.schedule.date).getTime();
      if (d1 !== d2) return d1 - d2;
      if (a.schedule.partner.name !== b.schedule.partner.name) return a.schedule.partner.name.localeCompare(b.schedule.partner.name);
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      return new Date(a.schedule.startTime).getTime() - new Date(b.schedule.startTime).getTime();
    });
    const merged = [];
    let i = 0;
    while (i < sorted.length) {
      let curr = sorted[i];
      let j = i + 1;
      while (
        j < sorted.length &&
        curr.schedule.date === sorted[j].schedule.date &&
        curr.schedule.partner.name === sorted[j].schedule.partner.name &&
        curr.status === sorted[j].status &&
        getTimeHM(curr.schedule.endTime) === getTimeHM(sorted[j].schedule.startTime)
      ) {
        // 合併到下一筆
        curr = {
          ...curr,
          schedule: {
            ...curr.schedule,
            endTime: sorted[j].schedule.endTime
          }
        };
        j++;
      }
      merged.push(curr);
      i = j;
    }
    return merged;
  }

  return (
    <div className="bg-gray-800/50 p-6 rounded-lg shadow-inner">
      <h2 className="text-xl font-bold mb-4 text-white">我的預約</h2>
      <div className="overflow-x-auto relative">
        {loading ? (
          <p className="text-center p-4 text-gray-300">正在載入您的預約...</p>
        ) : error ? (
          <p className="text-center p-4 text-red-400">{error}</p>
        ) : bookings.length === 0 ? (
          <p className="text-center p-4 text-gray-400">您目前沒有任何預約。</p>
        ) : (
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
              <tr>
                <th scope="col" className="py-3 px-6">預約者</th>
                <th scope="col" className="py-3 px-6">預約日期</th>
                <th scope="col" className="py-3 px-6">時段</th>
                <th scope="col" className="py-3 px-6">狀態</th>
                <th scope="col" className="py-3 px-6">服務人員</th>
              </tr>
            </thead>
            <tbody>
              {mergeBookings(bookings).map(b => (
                <tr key={b.id + b.schedule.startTime + b.schedule.endTime} className="bg-gray-800/60 border-b border-gray-700 hover:bg-gray-700/80">
                  <td className="py-4 px-6">{session?.user?.name || session?.user?.email || 'N/A'}</td>
                  <td className="py-4 px-6">{b.schedule?.date ? new Date(b.schedule.date).toLocaleDateString() : ''}</td>
                  <td className="py-4 px-6">
                    {b.schedule?.startTime ? new Date(b.schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}-
                    {b.schedule?.endTime ? new Date(b.schedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                  </td>
                  <td className="py-4 px-6">{b.status}</td>
                  <td className="py-4 px-6">{b.schedule?.partner?.name || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showReviewForm && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-gray-800">
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
              className="mt-4 w-full text-center py-2 text-sm text-gray-500 hover:bg-gray-100 rounded"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 