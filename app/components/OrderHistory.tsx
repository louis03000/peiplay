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
      <table className="w-full border">
        <thead>
          <tr>
            <th>消費日期</th>
            <th>金額</th>
            <th>陪玩師</th>
            <th>預約時段</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>{new Date(o.createdAt).toLocaleString()}</td>
              <td>${o.amount}</td>
              <td>{o.booking?.schedule?.partner?.name || 'N/A'}</td>
              <td>
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