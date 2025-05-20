"use client"
import { useEffect, useState } from "react"

export default function MyBookings() {
  const [bookings, setBookings] = useState<any[]>([])
  useEffect(() => {
    fetch("/api/bookings").then(res => res.json()).then(data => setBookings(data.bookings || []))
  }, [])
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
} 