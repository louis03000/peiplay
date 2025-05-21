'use client'
import { useEffect, useState } from 'react'
import PartnerCard from '../components/PartnerCard'

interface Partner {
  id: string;
  name: string;
  games: string[];
  hourlyRate: number;
  coverImage?: string;
  schedules: { date: string; startTime: string; endTime: string }[];
}

export default function Home() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/partners')
      .then(res => res.json())
      .then(data => setPartners(data))
      .catch(() => setPartners([]))
      .finally(() => setLoading(false))
  }, [])

  const handleQuickBook = (partner: Partner, schedule: { date: string; startTime: string; endTime: string }) => {
    // 這裡可串接預約 API 或彈窗
    setMessage(`已預約 ${partner.name} 的時段：${schedule.date} ${schedule.startTime}~${schedule.endTime}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <h1 className="text-4xl font-bold mb-8 text-center">PeiPlay 夥伴列表</h1>
        {message && (
          <div className="text-center py-3 mb-4 rounded-lg bg-green-100 text-green-700">{message}</div>
        )}
        {loading ? (
          <div className="text-center text-lg text-gray-500 py-12">載入中...</div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map(partner => (
              <PartnerCard key={partner.id} partner={partner} onQuickBook={handleQuickBook} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
