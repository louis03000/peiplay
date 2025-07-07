'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import PartnerHero from '../../components/PartnerHero'
import PartnerFilter from '../../components/PartnerFilter'
import PartnerCard from '../../components/PartnerCard'

interface Partner {
  id: string;
  name: string;
  games: string[];
  halfHourlyRate: number;
  coverImage?: string;
  schedules: { date: string; startTime: string; endTime: string }[];
  isAvailableNow: boolean;
  isRankBooster?: boolean;
  rankBoosterNote?: string;
  rankBoosterRank?: string;
  customerMessage?: string;
}

interface Customer {
  name?: string;
  birthday?: string;
  phone?: string;
  email?: string;
  userId?: string;
}

async function fetchPartners(startDate?: string, endDate?: string) {
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)
  const res = await fetch(`/api/partners?${params.toString()}`)
  if (!res.ok) throw new Error('獲取夥伴失敗')
  const data = await res.json()
  return (data as Array<{ id: string; name: string; games: string[]; hourlyRate: number; coverImage?: string; isAvailableNow: boolean; isRankBooster?: boolean; rankBoosterNote?: string; rankBoosterRank?: string; customerMessage?: string; schedules?: unknown[] }>).map((p) => ({
    id: p.id,
    name: p.name,
    games: p.games,
    halfHourlyRate: p.hourlyRate,
    coverImage: p.coverImage,
    isAvailableNow: p.isAvailableNow,
    isRankBooster: p.isRankBooster,
    rankBoosterNote: p.rankBoosterNote,
    rankBoosterRank: p.rankBoosterRank,
    customerMessage: p.customerMessage,
    schedules: (p.schedules || []).map((s) => ({
      date: (s as { date: string }).date,
      startTime: (s as { startTime: string }).startTime,
      endTime: (s as { endTime: string }).endTime
    }))
  }))
}

async function fetchCustomerProfile() {
  const res = await fetch('/api/customer/me')
  if (!res.ok) return null
  return await res.json()
}

async function quickBook(partner: Partner, schedule: { date: string; startTime: string; endTime: string }, customer: Customer) {
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partnerId: partner.id,
      date: schedule.date,
      startTime: schedule.startTime,
      duration: 1,
      name: customer?.name || '即時用戶',
      birthday: customer?.birthday || '2000-01-01',
      phone: customer?.phone || '0912345678',
      email: customer?.email || `quick${Date.now()}@test.com`,
      password: customer ? undefined : 'quickbook123',
      userId: customer?.userId,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '預約失敗')
  return data
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [showCards, setShowCards] = useState(false)
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined, status: "unauthenticated" };
  const session = sessionData.data;
  const status = sessionData.status;

  const handleFilter = async (start: string, end: string) => {
    setLoading(true)
    try {
      const data = await fetchPartners(start, end)
      setPartners(data)
      setShowCards(true)
    } catch {
      setPartners([])
      setShowCards(true)
    }
    setLoading(false)
  }

  const handleQuickBook = async (partner: Partner, schedule: { date: string; startTime: string; endTime: string }) => {
    setMessage(null)
    try {
      await quickBook(partner, schedule, customer as Customer)
      setMessage('預約成功！')
      handleFilter('', '')
    } catch (err) {
      setMessage((err instanceof Error ? err.message : '預約失敗'))
    }
  }

  useEffect(() => {
    // 預設不顯示卡片
    setShowCards(false)
  }, [])

  useEffect(() => {
    if (session?.user) {
      fetchCustomerProfile().then(setCustomer)
    } else {
      setCustomer(null)
    }
  }, [session?.user])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <PartnerHero onCTAClick={() => {
        document.getElementById('partner-filter')?.scrollIntoView({ behavior: 'smooth' })
      }} />
      <div id="partner-filter">
        <PartnerFilter onFilter={handleFilter} />
      </div>
      <div className="max-w-7xl mx-auto px-4 pb-16">
        {message && (
          <div className={`text-center py-3 mb-4 rounded-lg ${message.includes('成功') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{message}</div>
        )}
        {loading ? (
          <div className="text-center text-lg text-gray-500 py-12">載入中...</div>
        ) : (
          showCards && (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {partners.map(partner => (
                <PartnerCard key={partner.id} partner={partner} onQuickBook={handleQuickBook} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
} 