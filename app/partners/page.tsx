'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PartnerCard from '@/components/PartnerCard'
import PartnerHero from '@/components/PartnerHero'
import PartnerFilter from '@/components/PartnerFilter'
import { useRouter } from 'next/navigation'

// 防抖 Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export type Partner = {
  id: string;
  name: string;
  games: string[];
  halfHourlyRate: number;
  coverImage?: string;
  images?: string[];
  schedules: { id: string; date: string; startTime: string; endTime: string, isAvailable: boolean }[];
  isAvailableNow: boolean;
  isRankBooster: boolean;
  customerMessage?: string;
};

export default function PartnersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    availableNow: false,
    rankBooster: false,
    startDate: '',
    endDate: ''
  });
  const [showCards, setShowCards] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  // 使用防抖的搜尋詞和篩選選項
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedFilterOptions = useDebounce(filterOptions, 300);

  // 檢查用戶是否為夥伴
  const [customer, setCustomer] = useState<any>(null)
  
  useEffect(() => {
    if (session?.user) {
      fetch('/api/customer/me')
        .then(res => res.json())
        .then(data => {
          if (data && data.id) {
            setCustomer(data)
          } else {
            setCustomer(null)
          }
        })
        .catch(() => {
          setCustomer(null)
        })
    } else {
      setCustomer(null)
    }
  }, [session?.user])

  // 處理翻面功能
  const handleCardFlip = (partnerId: string) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(partnerId)) {
        newSet.delete(partnerId);
      } else {
        newSet.add(partnerId);
      }
      return newSet;
    });
  };

  // 獲取夥伴資料
  useEffect(() => {
    const fetchPartners = async () => {
      setLoading(true)
      setError('')
      
      try {
        const params = new URLSearchParams()
        
        if (debouncedFilterOptions.availableNow) {
          params.append('availableNow', 'true')
        }
        if (debouncedFilterOptions.rankBooster) {
          params.append('rankBooster', 'true')
        }
        if (debouncedFilterOptions.startDate) {
          params.append('startDate', debouncedFilterOptions.startDate)
        }
        if (debouncedFilterOptions.endDate) {
          params.append('endDate', debouncedFilterOptions.endDate)
        }
        
        const response = await fetch(`/api/partners?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch partners')
        }
        
        const data = await response.json()
        setPartners(data)
        setShowCards(true)
      } catch (err) {
        setError('載入夥伴資料失敗')
        console.error('Error fetching partners:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPartners()
  }, [debouncedFilterOptions])

  // 篩選夥伴
  const filteredPartners = useMemo(() => {
    if (!debouncedSearchTerm) return partners
    
    const searchLower = debouncedSearchTerm.toLowerCase()
    return partners.filter(partner => 
      partner.name.toLowerCase().includes(searchLower) ||
      partner.games.some(game => game.toLowerCase().includes(searchLower))
    )
  }, [partners, debouncedSearchTerm])

  const handleFilter = useCallback((options: any) => {
    setFilterOptions(options)
  }, [])

  const handleQuickBook = useCallback((partnerId: string) => {
    router.push(`/booking?partnerId=${partnerId}`)
  }, [router])

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 pt-20">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">遊戲夥伴</h1>
          <p className="text-gray-600 text-lg">找到最適合的遊戲夥伴，享受更好的遊戲體驗</p>
        </div>
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
          
          {/* 搜尋框 */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="搜尋夥伴姓名或遊戲..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-gray-500">載入夥伴資料中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                重新載入
              </button>
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🔍</div>
              <p className="text-gray-500 text-lg mb-2">
                {searchTerm ? '搜尋無結果' : '目前沒有夥伴'}
              </p>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="text-purple-500 hover:text-purple-600 transition-colors"
                >
                  清除搜尋
                </button>
              )}
            </div>
          ) : (
            showCards && (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPartners.map(partner => (
                  <PartnerCard 
                    key={partner.id} 
                    partner={partner} 
                    onQuickBook={handleQuickBook} 
                    showNextStep={true}
                    flipped={flippedCards.has(partner.id)}
                    onFlip={() => handleCardFlip(partner.id)}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
} 