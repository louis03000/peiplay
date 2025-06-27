'use client'
import MyBookings from '@/app/components/MyBookings'
import OrderHistory from '@/app/components/OrderHistory'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'

export default function ProfileClient() {
  const { data: session } = useSession();
  const [form, setForm] = useState({ name: '', phone: '', birthday: '', discord: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // 初始載入 user 資料
  useEffect(() => {
    if (session?.user) {
      setForm({
        name: session.user.name || '',
        phone: session.user.phone || '',
        birthday: session.user.birthday ? session.user.birthday.slice(0, 10) : '',
        discord: session.user.discord || ''
      });
    }
  }, [session]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    // Discord ID 格式驗證
    if (form.discord && !/^[0-9]{17,20}$/.test(form.discord)) {
      setLoading(false);
      setError('請輸入正確的 Discord 數字 ID（17~20 位數字，可在 Discord 開發者模式下複製）');
      return;
    }
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('資料已更新！');
      } else {
        setError(data.error || '更新失敗');
      }
    } catch (err) {
      setError('更新失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">會員中心</h1>
      <form className="max-w-md mx-auto bg-gray-800/60 p-6 rounded-lg mb-8" onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold mb-4 text-white">修改個人資料</h2>
        <div className="mb-4">
          <label className="block text-gray-300 mb-1">姓名</label>
          <input name="name" value={form.name} onChange={handleChange} className="w-full px-3 py-2 rounded bg-gray-900 text-white" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-300 mb-1">電話</label>
          <input name="phone" value={form.phone} onChange={handleChange} className="w-full px-3 py-2 rounded bg-gray-900 text-white" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-300 mb-1">生日</label>
          <input name="birthday" type="date" value={form.birthday} onChange={handleChange} className="w-full px-3 py-2 rounded bg-gray-900 text-white" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-300 mb-1">Discord ID</label>
          <input name="discord" value={form.discord} onChange={handleChange} className="w-full px-3 py-2 rounded bg-gray-900 text-white" />
          <p className="text-xs text-gray-400 mt-1">請填寫 Discord 數字 ID（開啟 Discord「設定→進階→開發者模式」後，右鍵頭像→複製使用者 ID）</p>
        </div>
        {success && <div className="text-green-400 mb-2">{success}</div>}
        {error && <div className="text-red-400 mb-2">{error}</div>}
        <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-bold" disabled={loading}>
          {loading ? '儲存中...' : '儲存'}
        </button>
      </form>
      <div className="space-y-8">
        <section>
          <MyBookings />
        </section>
        <section>
          <OrderHistory />
        </section>
      </div>
    </div>
  )
} 