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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/orders")
        if (!res.ok) throw new Error('無法載入訂單資料')
        const data = await res.json()
        setOrders(data.orders || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '載入失敗')
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  // 分頁計算
  const totalPages = Math.ceil(orders.length / pageSize)
  const pagedOrders = orders.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="bg-gray-800/50 p-6 rounded-lg shadow-inner">
      {/* 標題和說明 */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2 text-white">消費紀錄</h2>
        <p className="text-gray-200 text-sm">
          顯示您作為顧客，向夥伴購買服務的消費記錄
        </p>
      </div>

      <div className="overflow-x-auto relative">
        {loading ? (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-3"></div>
            <p className="text-gray-200">正在載入消費紀錄...</p>
          </div>
        ) : error ? (
          <div className="text-center p-4">
            <p className="text-red-400">{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center p-8">
            <div className="text-gray-400 text-4xl mb-3">💰</div>
            <p className="text-gray-300">您目前沒有任何消費紀錄</p>
            <p className="text-gray-400 text-sm mt-1">完成預約後會顯示在這裡</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left text-gray-200">
            <thead className="text-xs text-gray-300 uppercase bg-gray-700/50">
              <tr>
                <th className="py-3 px-6">消費日期</th>
                <th className="py-3 px-6">消費金額</th>
                <th className="py-3 px-6">服務夥伴</th>
                <th className="py-3 px-6">服務時段</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order, idx) => (
                <tr key={order.id} 
                    className={`border-b border-gray-700 hover:bg-gray-700/80 transition-colors ${
                      idx % 2 === 0 ? "bg-gray-800/60" : "bg-gray-800/40"
                    }`}>
                  <td className="py-4 px-6">
                    {new Date(order.createdAt).toLocaleString('zh-TW', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="py-4 px-6 font-medium text-green-400">
                    NT$ {order.amount.toLocaleString()}
                  </td>
                  <td className="py-4 px-6 font-medium">
                    {order.booking?.schedule?.partner?.name || '未知夥伴'}
                  </td>
                  <td className="py-4 px-6">
                    {order.booking?.schedule?.date && order.booking?.schedule?.startTime && order.booking?.schedule?.endTime
                      ? `${new Date(order.booking.schedule.date).getFullYear()}/${(new Date(order.booking.schedule.date).getMonth()+1).toString().padStart(2,'0')}/${new Date(order.booking.schedule.date).getDate().toString().padStart(2,'0')} ` +
                        `${order.booking.schedule.startTime.slice(0,5)} - ${order.booking.schedule.endTime.slice(0,5)}`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分頁按鈕 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >上一頁</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              className={`px-3 py-1 rounded ${currentPage === i + 1 ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              onClick={() => setCurrentPage(i + 1)}
            >{i + 1}</button>
          ))}
          <button
            className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >下一頁</button>
        </div>
      )}

      {/* 統計資訊 */}
      {orders.length > 0 && (
        <div className="mt-4 flex justify-between items-center text-gray-400 text-sm">
          <span>共 {orders.length} 筆消費記錄</span>
          <span className="font-medium">
            總消費金額: NT$ {orders.reduce((sum, order) => sum + order.amount, 0).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
} 