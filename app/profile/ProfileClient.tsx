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

  // 初始載入 user 資料（改為 fetch /api/user/profile）
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/user/profile');
        const data = await res.json();
        if (res.ok && data.user) {
          setForm({
            name: data.user.name || '',
            phone: data.user.phone || '',
            birthday: data.user.birthday ? data.user.birthday.slice(0, 10) : '',
            discord: data.user.discord || ''
          });
        }
      } catch {
        // ignore
      }
    }
    fetchProfile();
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
        // 儲存成功後自動 fetch 最新 user 資料
        const userRes = await fetch('/api/user/profile');
        const userData = await userRes.json();
        if (userRes.ok && userData.user) {
          setForm({
            name: userData.user.name || '',
            phone: userData.user.phone || '',
            birthday: userData.user.birthday ? userData.user.birthday.slice(0, 10) : '',
            discord: userData.user.discord || ''
          });
        }
        setEditMode(false); // 儲存成功後自動切回檢視模式
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
      {/* 頁面標題 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">會員中心</h1>
        <p className="text-gray-300">
          {session?.user?.role === 'PARTNER' 
            ? '管理您的個人資料、預約服務和客戶訂單' 
            : '管理您的個人資料、預約記錄和消費紀錄'
          }
        </p>
      </div>

      {/* 個人資料區塊 */}
      <div className="max-w-4xl mx-auto mb-12">
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center">
            <span className="mr-2">👤</span>
            個人資料
          </h2>
          <p className="text-gray-300 text-sm mb-4">
            管理您的個人基本資料，這些資訊會用於服務聯繫和身份驗證
          </p>
          
          {!editMode ? (
            <div className="bg-gray-800/60 p-6 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><span className="block text-gray-300 mb-1">姓名</span><span className="text-white font-medium">{form.name}</span></div>
                <div><span className="block text-gray-300 mb-1">電話</span><span className="text-white font-medium">{form.phone || '-'}</span></div>
                <div><span className="block text-gray-300 mb-1">生日</span><span className="text-white font-medium">{form.birthday ? (typeof form.birthday === 'string' ? form.birthday : new Date(form.birthday).toLocaleDateString()) : '-'}</span></div>
                <div><span className="block text-gray-300 mb-1">Discord 名稱</span><span className="text-white font-medium">{form.discord || '-'}</span></div>
              </div>
              <button className="w-full py-3 rounded-lg bg-indigo-500 text-white font-bold text-lg mt-6 hover:bg-indigo-600 transition" onClick={() => setEditMode(true)}>
                修改個人資料
              </button>
            </div>
          ) : (
            <form className="bg-gray-800/60 p-6 rounded-lg" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1">姓名</label>
                  <input name="name" value={form.name} onChange={handleChange} className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">電話</label>
                  <input name="phone" value={form.phone} onChange={handleChange} className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">生日</label>
                  <input name="birthday" type="date" value={form.birthday} onChange={handleChange} className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Discord 名稱</label>
                  <input name="discord" value={form.discord} onChange={handleChange} className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              {success && <div className="text-green-400 mb-4 text-center">{success}</div>}
              {error && <div className="text-red-400 mb-4 text-center">{error}</div>}
              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-bold transition" disabled={loading}>
                  {loading ? '儲存中...' : '儲存變更'}
                </button>
                <button type="button" className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 rounded text-white font-bold transition" onClick={() => setEditMode(false)}>
                  取消
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 預約和訂單管理區塊 */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center">
            <span className="mr-2">📋</span>
            預約與訂單管理
          </h2>
          <p className="text-gray-300 text-sm mb-6">
            {session?.user?.role === 'PARTNER' 
              ? '管理您的服務預約和客戶訂單，查看服務記錄和收入統計'
              : '查看您的預約記錄和消費紀錄，管理服務評價'
            }
          </p>
          
          <div className="space-y-8">
            <section>
              <MyBookings />
            </section>
            <section>
              <OrderHistory />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
} 