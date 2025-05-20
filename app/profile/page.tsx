'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import OrderHistory from '@/components/OrderHistory'
import MyBookings from '@/components/MyBookings'

const tabs = [
  { key: 'profile', label: '個人資料' },
  { key: 'orders', label: '消費紀錄' },
  { key: 'bookings', label: '我的預約' },
]

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: '', phone: '', birthday: '', email: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tab, setTab] = useState('profile')

  useEffect(() => {
    fetch('/api/customer/me').then(async res => {
      if (res.ok) {
        const data = await res.json()
        setProfile({
          name: data.name || '',
          phone: data.phone || '',
          birthday: data.birthday ? data.birthday.slice(0, 10) : '',
          email: data.email || '',
        })
      }
      setLoading(false)
    })
  }, [])

  const handleChange = (e: any) => {
    setProfile({ ...profile, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/customer/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage('儲存成功！')
    } else {
      setMessage(data.error || '儲存失敗')
    }
    setSaving(false)
  }

  if (loading) return <div className="text-center py-12">載入中...</div>

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 py-10">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-0">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`flex-1 py-4 text-lg font-semibold transition-colors duration-150 ${tab === t.key ? 'text-purple-600 border-b-4 border-purple-500 bg-purple-50 dark:bg-slate-800' : 'text-gray-500 hover:text-purple-500'}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-8">
          {tab === 'profile' && (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-center">個人資料設定</h2>
              <div className="mb-4">
                <label className="block mb-1 font-medium">姓名</label>
                <input name="name" value={profile.name} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-black" required />
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-medium">電話</label>
                <input name="phone" value={profile.phone} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-black" required />
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-medium">生日</label>
                <input type="date" name="birthday" value={profile.birthday} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-black" required />
              </div>
              <div className="mb-6">
                <label className="block mb-1 font-medium">Email</label>
                <input type="email" name="email" value={profile.email} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-black" required />
              </div>
              {message && <div className={`mb-4 text-center ${message.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>{message}</div>}
              <button type="submit" className="w-full py-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold text-lg shadow-lg" disabled={saving}>
                {saving ? '儲存中...' : '儲存'}
              </button>
            </form>
          )}
          {tab === 'orders' && <OrderHistory />}
          {tab === 'bookings' && <MyBookings />}
        </div>
      </div>
    </div>
  )
} 