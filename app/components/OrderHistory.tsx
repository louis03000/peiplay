"use client"
import { useEffect, useState } from "react"

interface Order {
  id: string
  amount: number
  createdAt: string
  booking?: {
    schedule?: {
      partner?: { name?: string }
      date?: string
      startTime?: string
      endTime?: string
    }
  }
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([])
  useEffect(() => {
    fetch("/api/orders").then(res => res.json()).then(data => setOrders(data.orders || []))
  }, [])
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">消費紀錄</h2>
      <table className="w-full border border-gray-700 text-sm">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="px-4 py-2 border border-gray-700 text-center">消費日期</th>
            <th className="px-4 py-2 border border-gray-700 text-center">金額</th>
            <th className="px-4 py-2 border border-gray-700 text-center">陪玩師</th>
            <th className="px-4 py-2 border border-gray-700 text-center">預約時段</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, idx) => (
            <tr key={o.id} className={idx % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}>
              <td className="px-4 py-2 border border-gray-700 text-center">{new Date(o.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2 border border-gray-700 text-center">${o.amount}</td>
              <td className="px-4 py-2 border border-gray-700 text-center">{o.booking?.schedule?.partner?.name || 'N/A'}</td>
              <td className="px-4 py-2 border border-gray-700 text-center">
                {o.booking?.schedule?.date
                  ? new Date(o.booking.schedule.date).toLocaleDateString()
                  : ''}
                {' '}
                {o.booking?.schedule?.startTime?.slice(0, 5)}-
                {o.booking?.schedule?.endTime?.slice(0, 5)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
} 