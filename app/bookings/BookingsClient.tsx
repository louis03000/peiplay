"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "", label: "全部狀態" },
  { value: "PENDING", label: "待確認" },
  { value: "CONFIRMED", label: "已確認" },
  { value: "REJECTED", label: "已拒絕" },
  { value: "CANCELLED", label: "已取消" },
  { value: "COMPLETED", label: "已完成" },
];

// Booking 型別定義
 type Booking = {
  id: string;
  status: string;
  createdAt?: string;
  customer?: {
    user?: {
      name?: string;
      email?: string;
    };
  };
  schedule?: {
    partner?: {
      name?: string;
    };
    date?: string;
    startTime?: string;
    endTime?: string;
  };
};

export default function BookingsClient() {
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [error, setError] = useState("");

  // 管理員可輸入 partnerId 查詢
  const isAdmin = session?.user?.role === "ADMIN";

  const fetchBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (date) params.append("date", date);
      if (isAdmin && partnerId) params.append("partnerId", partnerId);
      const res = await fetch(`/api/bookings?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setBookings(data.bookings || []);
      } else {
        setError(data.error || "查詢失敗");
      }
    } catch {
      setError("查詢失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchBookings();
    // eslint-disable-next-line
  }, [session]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">預約查詢</h1>
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm mb-1">狀態</label>
          <select
            className="border rounded px-3 py-2"
            value={status}
            onChange={event => setStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">日期</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={date}
            onChange={event => setDate(event.target.value)}
          />
        </div>
        {isAdmin && (
          <div>
            <label className="block text-sm mb-1">夥伴ID</label>
            <input
              type="text"
              className="border rounded px-3 py-2"
              value={partnerId}
              onChange={event => setPartnerId(event.target.value)}
              placeholder="輸入夥伴ID查詢"
            />
          </div>
        )}
        <button
          className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700"
          onClick={fetchBookings}
          disabled={loading}
        >
          查詢
        </button>
      </div>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">預約ID</th>
              <th className="border px-2 py-1">顧客</th>
              <th className="border px-2 py-1">夥伴</th>
              <th className="border px-2 py-1">日期</th>
              <th className="border px-2 py-1">時段</th>
              <th className="border px-2 py-1">狀態</th>
              <th className="border px-2 py-1">建立時間</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-4">無資料</td>
              </tr>
            )}
            {bookings.map((b: Booking) => (
              <tr key={b.id}>
                <td className="border px-2 py-1">{b.id}</td>
                <td className="border px-2 py-1">{b.customer?.user?.name || b.customer?.user?.email || '-'}</td>
                <td className="border px-2 py-1">{b.schedule?.partner?.name || '-'}</td>
                <td className="border px-2 py-1">{b.schedule?.date ? format(new Date(b.schedule.date), 'yyyy-MM-dd') : '-'}</td>
                <td className="border px-2 py-1">{b.schedule?.startTime && b.schedule?.endTime ? `${b.schedule.startTime.slice(0,5)}-${b.schedule.endTime.slice(0,5)}` : '-'}</td>
                <td className="border px-2 py-1">{b.status}</td>
                <td className="border px-2 py-1">{b.createdAt ? format(new Date(b.createdAt), 'yyyy-MM-dd HH:mm') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 