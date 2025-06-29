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
  const [tab, setTab] = useState<'me' | 'partner'>('me')
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 根據身分預設分頁
  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role === 'PARTNER') setTab('partner')
      else setTab('me')
    }
  }, [status, session])

  // 取得資料
  useEffect(() => {
    if (status === 'authenticated') {
      setLoading(true)
      setError(null)
      const url = tab === 'me' ? '/api/bookings/me' : '/api/bookings/partner'
      fetch(url)
        .then(res => res.json())
        .then(data => setBookings(data.bookings || []))
        .catch(err => setError('載入失敗'))
        .finally(() => setLoading(false))
    }
  }, [status, tab])

  // 合併連續時段的預約
  function mergeBookings(bookings: any[]) {
    if (!bookings.length) return [];
    const sorted = [...bookings].sort((a, b) => {
      const t1 = new Date(a.schedule.startTime).getTime();
      const t2 = new Date(b.schedule.startTime).getTime();
      const partnerA = (a.schedule?.partner?.name || '').trim().toLowerCase();
      const partnerB = (b.schedule?.partner?.name || '').trim().toLowerCase();
      return partnerA.localeCompare(partnerB) || t1 - t2;
    });
    const merged = [];
    let i = 0;
    while (i < sorted.length) {
      let curr = sorted[i];
      let j = i + 1;
      let mergedStartTime = curr.schedule.startTime;
      let mergedEndTime = curr.schedule.endTime;
      const partnerA = (curr.schedule?.partner?.name || '').trim().toLowerCase();
      while (
        j < sorted.length &&
        (sorted[j].schedule?.partner?.name || '').trim().toLowerCase() === partnerA &&
        new Date(mergedEndTime).getTime() === new Date(sorted[j].schedule.startTime).getTime()
      ) {
        mergedEndTime = sorted[j].schedule.endTime;
        j++;
      }
      merged.push({
        ...curr,
        schedule: {
          ...curr.schedule,
          startTime: mergedStartTime,
          endTime: mergedEndTime
        }
      });
      i = j;
    }
    return merged;
  }

  if (status === 'loading') {
    return <div className="text-center p-8 text-white">載入中...</div>
  }
  if (!session) {
    return <div className="text-center p-8 text-white">請先登入以查詢預約。</div>
  }
  // debug session
  console.log('session', session)

  return (
    <div className="max-w-6xl mx-auto mt-16 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
      <div className="flex justify-center gap-4 mb-8">
        <button
          className={`px-6 py-2 rounded-t-lg font-bold ${tab === 'me' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          onClick={() => setTab('me')}
        >我的預約</button>
        <button
          className={`px-6 py-2 rounded-t-lg font-bold ${tab === 'partner' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          onClick={() => setTab('partner')}
        >我的訂單</button>
      </div>
      <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
        {loading ? (
          <p className="text-center p-4 text-white">正在載入預約...</p>
        ) : error ? (
          <p className="text-center p-4 text-red-400">{error}</p>
        ) : bookings.length === 0 ? (
          <p className="text-center p-4 text-gray-400">找不到預約。</p>
        ) : (
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
              <tr>
                {tab === 'partner' && <th className="py-3 px-6">顧客</th>}
                {tab === 'me' && <th className="py-3 px-6">夥伴</th>}
                <th className="py-3 px-6">日期</th>
                <th className="py-3 px-6">時間</th>
                <th className="py-3 px-6">狀態</th>
              </tr>
            </thead>
            <tbody>
              {mergeBookings(bookings).map((booking) => (
                <tr key={booking.id + booking.schedule.startTime + booking.schedule.endTime} className="bg-gray-800/60 border-b border-gray-700 hover:bg-gray-700/80">
                  {tab === 'partner' && <td className="py-4 px-6">{booking.customer?.name || '-'}</td>}
                  {tab === 'me' && <td className="py-4 px-6">{booking.schedule?.partner?.name || '-'}</td>}
                  <td className="py-4 px-6">{booking.schedule?.startTime ? new Date(booking.schedule.startTime).toLocaleDateString() : '-'}</td>
                  <td className="py-4 px-6">{booking.schedule?.startTime && booking.schedule?.endTime ? `${new Date(booking.schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${new Date(booking.schedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}` : '-'}</td>
                  <td className="py-4 px-6">{booking.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
} 