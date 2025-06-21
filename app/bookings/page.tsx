'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type Booking = {
  id: string;
  status: string;
  createdAt: string;
  schedule: {
    date: string;
    startTime: string;
    endTime: string;
    partner: {
      name: string;
    };
  };
  customer: {
    name: string;
  };
}

export default function BookingsPage() {
  const { data: session, status } = useSession()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    if (status === 'authenticated') {
      const fetchBookings = async () => {
        setLoading(true)
        setError(null)
        try {
          const query = new URLSearchParams({ status: filterStatus }).toString()
          const res = await fetch(`/api/bookings?${query}`)
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || '無法載入預約資料')
          }
          const data = await res.json()
          setBookings(data.bookings || [])
        } catch (err) {
          setError(err instanceof Error ? err.message : '發生未知錯誤')
        } finally {
          setLoading(false)
        }
      }
      fetchBookings()
    }
  }, [status, filterStatus])

  if (status === 'loading') {
    return <div className="text-center p-8 text-white">載入中...</div>
  }

  if (!session) {
    return <div className="text-center p-8 text-white">請先登入以查看預約。</div>
  }

  return (
    <div className="max-w-6xl mx-auto mt-16 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
      <h1 className="text-3xl font-bold mb-6 text-center text-white">查詢預約</h1>

      <div className="mb-6 flex justify-center gap-4">
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-300 mb-1">
            預約狀態
          </label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
          >
            <option value="">所有狀態</option>
            <option value="PENDING">待確認</option>
            <option value="CONFIRMED">已確認</option>
            <option value="COMPLETED">已完成</option>
            <option value="CANCELLED">已取消</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
        {loading ? (
          <p className="text-center p-4 text-white">正在載入預約...</p>
        ) : error ? (
          <p className="text-center p-4 text-red-400">{error}</p>
        ) : bookings.length === 0 ? (
          <p className="text-center p-4 text-gray-400">找不到符合條件的預約。</p>
        ) : (
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
              <tr>
                {session.user.role !== 'CUSTOMER' && <th scope="col" className="py-3 px-6">顧客</th>}
                {session.user.role !== 'PARTNER' && <th scope="col" className="py-3 px-6">夥伴</th>}
                <th scope="col" className="py-3 px-6">日期</th>
                <th scope="col" className="py-3 px-6">時間</th>
                <th scope="col" className="py-3 px-6">狀態</th>
                <th scope="col" className="py-3 px-6">預約時間</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="bg-gray-800/60 border-b border-gray-700 hover:bg-gray-700/80">
                  {session.user.role !== 'CUSTOMER' && <td className="py-4 px-6">{booking.customer.name}</td>}
                  {session.user.role !== 'PARTNER' && <td className="py-4 px-6">{booking.schedule.partner.name}</td>}
                  <td className="py-4 px-6">{new Date(booking.schedule.date).toLocaleDateString()}</td>
                  <td className="py-4 px-6">
                    {new Date(booking.schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - 
                    {new Date(booking.schedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </td>
                  <td className="py-4 px-6">{booking.status}</td>
                  <td className="py-4 px-6">{new Date(booking.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
} 