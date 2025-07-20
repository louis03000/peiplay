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
  rejectReason?: string; // Added for rejected bookings
}

export default function MyBookings() {
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [cancellingBooking, setCancellingBooking] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings");
      if (!res.ok) throw new Error('無法載入預約資料');
      const data = await res.json();
      setBookings(data.bookings || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗');
    } finally {
      setLoading(false);
    }
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

  // 檢查是否可以取消預約
  const canCancel = (booking: Booking) => {
    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
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
        fetchBookings(); // 重新載入預約資料
      } else {
        alert(data.error || '取消預約失敗');
      }
    } catch (error) {
      alert('取消預約時發生錯誤，請稍後再試');
    } finally {
      setCancellingBooking(null);
    }
  };

  // 取得狀態中文說明
  function getStatusText(status: string) {
    const statusMap: { [key: string]: string } = {
      'PENDING': '待確認',
      'CONFIRMED': '已確認',
      'REJECTED': '已拒絕',
      'CANCELLED': '已取消',
      'COMPLETED': '已完成'
    }
    return statusMap[status] || status
  }

  // 合併連續時段的預約
  function getTimeHM(dateStr: string) {
    const d = new Date(dateStr);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }
  function mergeBookings(bookings: Booking[]) {
    if (!bookings.length) return [];
    const sorted = [...bookings].sort((a, b) => {
      const t1 = new Date(a.schedule.startTime).getTime();
      const t2 = new Date(b.schedule.startTime).getTime();
      if (a.schedule.partner.name !== b.schedule.partner.name) return a.schedule.partner.name.localeCompare(b.schedule.partner.name);
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      return t1 - t2;
    });
    const merged = [];
    let i = 0;
    while (i < sorted.length) {
      let curr = sorted[i];
      let j = i + 1;
      let mergedStartTime = curr.schedule.startTime;
      let mergedEndTime = curr.schedule.endTime;
      while (
        j < sorted.length &&
        curr.schedule.partner.name === sorted[j].schedule.partner.name &&
        curr.status === sorted[j].status &&
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

  // 先合併，再排序，再分頁
  const merged = mergeBookings(bookings);
  // 只顯示已完成的預約
  const completedBookings = merged.filter(booking => booking.status === 'COMPLETED');
  const sortedMerged = completedBookings.sort((a, b) => new Date(b.schedule.startTime).getTime() - new Date(a.schedule.startTime).getTime());
  const pagedBookings = sortedMerged.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(sortedMerged.length / pageSize);

  return (
    <div className="bg-gray-800/50 p-6 rounded-lg shadow-inner">
      {/* 標題和說明 */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2 text-white">預約紀錄</h2>
        <p className="text-gray-300 text-sm">
          顯示您作為顧客，夥伴已確認且已完成的預約記錄
        </p>
      </div>

      <div className="overflow-x-auto relative">
        {loading ? (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-3"></div>
            <p className="text-gray-300">正在載入您的預約...</p>
          </div>
        ) : error ? (
          <div className="text-center p-4">
            <p className="text-red-400">{error}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center p-8">
            <div className="text-gray-400 text-4xl mb-3">📅</div>
            <p className="text-gray-400">您目前沒有任何預約</p>
            <p className="text-gray-500 text-sm mt-1">快去預約喜歡的夥伴吧！</p>
          </div>
        ) : (
          <>
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
              <tr>
                <th scope="col" className="py-3 px-6">預約日期</th>
                <th scope="col" className="py-3 px-6">服務時段</th>
                <th scope="col" className="py-3 px-6">夥伴姓名</th>
                <th scope="col" className="py-3 px-6">預約狀態</th>
                <th scope="col" className="py-3 px-6">操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedBookings.map(b => (
                <tr key={b.id + b.schedule.startTime + b.schedule.endTime} 
                    className="bg-gray-800/60 border-b border-gray-700 hover:bg-gray-700/80 transition-colors">
                  <td className="py-4 px-6">
                    {b.schedule?.startTime 
                      ? new Date(b.schedule.startTime).toLocaleDateString('zh-TW') 
                      : '-'
                    }
                  </td>
                  <td className="py-4 px-6">
                    {b.schedule?.startTime && b.schedule?.endTime 
                      ? `${new Date(b.schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${new Date(b.schedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
                      : '-'
                    }
                  </td>
                  <td className="py-4 px-6 font-medium">
                    {b.schedule?.partner?.name || '未知夥伴'}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      b.status === 'CONFIRMED' ? 'bg-green-600 text-white' :
                      b.status === 'PENDING' ? 'bg-yellow-600 text-white' :
                      b.status === 'REJECTED' ? 'bg-red-500 text-white' :
                      b.status === 'CANCELLED' ? 'bg-red-600 text-white' :
                      b.status === 'COMPLETED' ? 'bg-blue-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {getStatusText(b.status)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2">
                      {canReview(b) && (
                        <button
                          onClick={() => {
                            setSelectedBooking(b)
                            setShowReviewForm(true)
                          }}
                          className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors"
                        >
                          評價
                        </button>
                      )}
                      {b.status === 'REJECTED' && b.rejectReason && (
                        <div className="text-xs text-red-400">拒絕原因：{b.rejectReason}</div>
                      )}
                      {canCancel(b) && b.status !== 'REJECTED' && (
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          disabled={cancellingBooking === b.id}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {cancellingBooking === b.id ? '取消中...' : '取消預約'}
                        </button>
                      )}
                    </div>
                  </td>
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
        <div className="mt-4 text-right text-gray-400 text-sm">
          共 {bookings.length} 筆預約記錄
        </div>
      )}

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