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
  const [cancellingBooking, setCancellingBooking] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

  // 檢查是否可以取消預約
  const canCancel = (booking: any) => {
    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED' || booking.status === 'REJECTED') {
      return false;
    }
    
    const now = new Date();
    const bookingStartTime = new Date(booking.schedule.startTime);
    const hoursUntilBooking = (bookingStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // 距離預約時間少於 2 小時不能取消
    return hoursUntilBooking >= 2;
  }

  // 取消預約
  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('確定要取消這個預約嗎？取消後無法復原。')) {
      return;
    }

    setCancellingBooking(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        alert('預約已成功取消！');
        // 重新載入資料
        setLoading(true)
        setError(null)
        const url = tab === 'me' ? '/api/bookings/me' : '/api/bookings/partner'
        fetch(url)
          .then(res => res.json())
          .then(data => setBookings(data.bookings || []))
          .catch(err => setError('載入失敗'))
          .finally(() => setLoading(false))
      } else {
        alert(data.error || '取消預約失敗');
      }
    } catch (error) {
      alert('取消預約時發生錯誤，請稍後再試');
        } finally {
      setCancellingBooking(null);
    }
  };

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

  // 取得狀態中文說明
  function getStatusText(status: string) {
    const statusMap: { [key: string]: string } = {
      'PENDING': '待確認',
      'PAID_WAITING_PARTNER_CONFIRMATION': '等待夥伴確認',
      'PARTNER_ACCEPTED': '夥伴已接受',
      'PARTNER_REJECTED': '夥伴已拒絕',
      'CONFIRMED': '已確認',
      'REJECTED': '已拒絕',
      'CANCELLED': '已取消',
      'COMPLETED': '已完成',
      'PENDING_PAYMENT': '待付款'
    }
    return statusMap[status] || status
  }

  // 分頁資料
  let filteredBookings = bookings;
  if (tab === 'me') {
    const now = new Date();
    filteredBookings = bookings.filter(b => {
      const start = new Date(b.schedule.startTime);
      // 顯示所有狀態的預約，包括已取消的
      // 但只顯示未來的預約（除非是已取消或已完成的）
      if (b.status === 'CANCELLED' || b.status === 'COMPLETED') {
        // 已取消或已完成的預約，顯示最近 30 天內的
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return start.getTime() > thirtyDaysAgo.getTime();
      } else {
        // 其他狀態的預約，只顯示未來的
        return start.getTime() > now.getTime();
      }
    });
  }
  const pagedBookings = mergeBookings(filteredBookings).slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(mergeBookings(filteredBookings).length / pageSize);

  if (status === 'loading') {
    return <div className="text-center p-8 text-white">載入中...</div>
  }
  if (!session) {
    return <div className="text-center p-8 text-white">請先登入以查詢預約。</div>
  }

  return (
    <div className="max-w-6xl mx-auto mt-16 pt-32 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
      {/* 頁面標題和說明 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">預約管理</h1>
        <p className="text-gray-300 text-lg">
          {session?.user?.role === 'PARTNER' 
            ? '管理您的預約服務和客戶訂單' 
            : '查看您的預約記錄和服務訂單'
          }
        </p>
      </div>

      {/* Tab 切換按鈕 */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          className={`px-8 py-3 rounded-lg font-bold transition-all duration-200 ${
            tab === 'me' 
              ? 'bg-indigo-600 text-white shadow-lg' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={() => setTab('me')}
        >
          <div className="text-center">
            <div className="text-lg">我的預約</div>
            <div className="text-xs opacity-80">我預約的夥伴</div>
          </div>
        </button>
        <button
          className={`px-8 py-3 rounded-lg font-bold transition-all duration-200 ${
            tab === 'partner' 
              ? 'bg-indigo-600 text-white shadow-lg' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={() => setTab('partner')}
        >
          <div className="text-center">
            <div className="text-lg">我的訂單</div>
            <div className="text-xs opacity-80">預約我的顧客</div>
          </div>
        </button>
      </div>

      {/* 功能說明 */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <div className="text-blue-400 text-xl">ℹ️</div>
          <div className="text-blue-100">
            <div className="font-semibold mb-1">
              {tab === 'me' ? '我的預約' : '我的訂單'} 說明：
            </div>
            <div className="text-sm">
              {tab === 'me' 
                ? '顯示您作為顧客，主動預約了哪些夥伴的服務時段。您可以查看預約狀態、時間安排等資訊。距離預約時間 2 小時前可以取消預約。'
                : '顯示您作為夥伴，被哪些顧客預約了服務時段。您可以查看客戶資訊、預約狀態等詳細資料。'
              }
            </div>
          </div>
        </div>
      </div>

      {/* 資料表格 */}
      <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
        {loading ? (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">正在載入{tab === 'me' ? '預約' : '訂單'}資料...</p>
          </div>
        ) : error ? (
          <div className="text-center p-8">
            <p className="text-red-400">{error}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center p-8">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <p className="text-gray-400 text-lg">
              目前沒有任何{tab === 'me' ? '預約' : '訂單'}記錄
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {tab === 'me' 
                ? '您還沒有預約任何夥伴的服務' 
                : '還沒有顧客預約您的服務'
              }
            </p>
          </div>
        ) : (
          <>
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
              <tr>
                {tab === 'partner' && <th className="py-3 px-6">顧客姓名</th>}
                {tab === 'me' && <th className="py-3 px-6">夥伴姓名</th>}
                <th className="py-3 px-6">預約日期</th>
                <th className="py-3 px-6">服務時段</th>
                <th className="py-3 px-6">預約狀態</th>
                <th className="py-3 px-6">建立時間</th>
                {(tab === 'me' || tab === 'partner') && <th className="py-3 px-6">操作</th>}
              </tr>
            </thead>
            <tbody>
              {pagedBookings.map((booking) => (
                <tr key={booking.id + booking.schedule.startTime + booking.schedule.endTime} 
                    className="bg-gray-800/60 border-b border-gray-700 hover:bg-gray-700/80 transition-colors">
                  {tab === 'partner' && (
                    <td className="py-4 px-6 font-medium">
                      {booking.customer?.name || '匿名顧客'}
                    </td>
                  )}
                  {tab === 'me' && (
                    <td className="py-4 px-6 font-medium">
                      {booking.schedule?.partner?.name || '未知夥伴'}
                    </td>
                  )}
                  <td className="py-4 px-6">
                    {booking.schedule?.startTime 
                      ? new Date(booking.schedule.startTime).toLocaleDateString('zh-TW') 
                      : '-'
                    }
                  </td>
                  <td className="py-4 px-6">
                    {booking.schedule?.startTime && booking.schedule?.endTime 
                      ? `${new Date(booking.schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${new Date(booking.schedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
                      : '-'
                    }
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      booking.status === 'CONFIRMED' ? 'bg-green-600 text-white' :
                      booking.status === 'PENDING' ? 'bg-yellow-600 text-white' :
                      booking.status === 'REJECTED' ? 'bg-red-500 text-white' :
                      booking.status === 'CANCELLED' ? 'bg-red-600 text-white' :
                      booking.status === 'COMPLETED' ? 'bg-blue-600 text-white' :
                      booking.status === 'PENDING_PAYMENT' ? 'bg-purple-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {getStatusText(booking.status)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-gray-400">
                    {booking.createdAt 
                      ? new Date(booking.createdAt).toLocaleString('zh-TW', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '-'
                    }
                  </td>
                  {tab === 'me' && (
                    <td className="py-4 px-6">
                      {canCancel(booking) && (
                        <button
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={cancellingBooking === booking.id}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {cancellingBooking === booking.id ? '取消中...' : '取消預約'}
                        </button>
                      )}
                    </td>
                  )}
                  {tab === 'partner' && (
                    <td className="py-4 px-6">
                      {booking.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                            onClick={async () => {
                              if (!confirm('確定要同意這個預約嗎？')) return;
                              const res = await fetch(`/api/bookings/${booking.id}/accept`, { method: 'POST' });
                              const data = await res.json();
                              if (res.ok) {
                                alert('已同意預約！');
                                setLoading(true);
                                setError(null);
                                fetch('/api/bookings/partner')
                                  .then(res => res.json())
                                  .then(data => setBookings(data.bookings || []))
                                  .catch(err => setError('載入失敗'))
                                  .finally(() => setLoading(false));
                              } else {
                                alert(data.error || '同意預約失敗');
                              }
                            }}
                          >同意</button>
                          <button
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                            onClick={async () => {
                              const reason = prompt('請輸入拒絕原因：');
                              if (!reason || reason.trim() === '') {
                                alert('拒絕原因是必需的');
                                return;
                              }
                              if (!confirm('確定要拒絕這個預約嗎？')) return;
                              const res = await fetch(`/api/bookings/${booking.id}/reject`, { 
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reason: reason.trim() })
                              });
                              const data = await res.json();
                              if (res.ok) {
                                alert('已拒絕預約！');
                                setLoading(true);
                                setError(null);
                                fetch('/api/bookings/partner')
                                  .then(res => res.json())
                                  .then(data => setBookings(data.bookings || []))
                                  .catch(err => setError('載入失敗'))
                                  .finally(() => setLoading(false));
                              } else {
                                alert(data.error || '拒絕預約失敗');
                              }
                            }}
                          >拒絕</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
          </>
        )}
      </div>

      {/* 統計資訊 */}
      {bookings.length > 0 && (
        <div className="mt-6 text-center text-gray-400 text-sm">
          共找到 {bookings.length} 筆{tab === 'me' ? '預約' : '訂單'}記錄
        </div>
      )}
    </div>
  )
} 