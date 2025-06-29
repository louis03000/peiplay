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
  const [editMode, setEditMode] = useState(false);

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
      <h1 className="text-2xl font-bold mb-8">個人資料</h1>
      {!editMode ? (
        <div className="max-w-md mx-auto bg-gray-800/60 p-6 rounded-lg mb-8">
          <h2 className="text-lg font-semibold mb-4 text-white">個人資料</h2>
          <div className="mb-4"><span className="block text-gray-300 mb-1">姓名</span><span className="text-white">{form.name}</span></div>
          <div className="mb-4"><span className="block text-gray-300 mb-1">電話</span><span className="text-white">{form.phone}</span></div>
          <div className="mb-4"><span className="block text-gray-300 mb-1">生日</span><span className="text-white">{form.birthday}</span></div>
          <div className="mb-4"><span className="block text-gray-300 mb-1">Discord 名稱</span><span className="text-white">{form.discord}</span></div>
          <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-bold mt-4" onClick={() => setEditMode(true)}>修改個人資料</button>
        </div>
      ) : (
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
            <label className="block text-gray-300 mb-1">Discord 名稱</label>
            <input name="discord" value={form.discord} onChange={handleChange} className="w-full px-3 py-2 rounded bg-gray-900 text-white" />
          </div>
          {success && <div className="text-green-400 mb-2">{success}</div>}
          {error && <div className="text-red-400 mb-2">{error}</div>}
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-bold" disabled={loading}>{loading ? '儲存中...' : '儲存'}</button>
            <button type="button" className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-bold" onClick={() => setEditMode(false)}>取消</button>
          </div>
        </form>
      )}
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