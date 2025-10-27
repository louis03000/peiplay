'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PartnerCard from '@/components/PartnerCard'
import PartnerHero from '@/components/PartnerHero'
import PartnerFilter from '@/components/PartnerFilter'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  schedules: { 
    id: string; 
    date: string; 
    startTime: string; 
    endTime: string; 
    isAvailable: boolean;
    bookings?: { status: string } | null;
    searchTimeRestriction?: {
      startTime: string;
      endTime: string;
      startDate: string;
      endDate: string;
    };
  }[];
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
    endDate: '',
    startTime: '',
    endTime: ''
  });
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
        // 如果有日期和時段篩選，使用新的時段搜尋API
        if (debouncedFilterOptions.startDate && debouncedFilterOptions.endDate && 
            debouncedFilterOptions.startTime && debouncedFilterOptions.endTime) {
          const params = new URLSearchParams()
          params.append('startDate', debouncedFilterOptions.startDate)
          params.append('endDate', debouncedFilterOptions.endDate)
          params.append('startTime', debouncedFilterOptions.startTime)
          params.append('endTime', debouncedFilterOptions.endTime)
          
          if (debouncedSearchTerm) {
            params.append('game', debouncedSearchTerm)
          }
          
          const response = await fetch(`/api/partners/search-by-time?${params}`)
          if (!response.ok) {
            throw new Error('Failed to fetch partners by time')
          }
          
          const data = await response.json()
          setPartners(data)
        } else {
          // 使用原有的夥伴API
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
          if (debouncedSearchTerm) {
            params.append('game', debouncedSearchTerm)
          }
          
          const response = await fetch(`/api/partners?${params.toString()}`)
          if (!response.ok) {
            throw new Error('Failed to fetch partners')
          }
          
          const data = await response.json()
          setPartners(data)
        }
      } catch (err) {
        setError('載入夥伴資料失敗')
        console.error('Error fetching partners:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPartners()
  }, [debouncedFilterOptions, debouncedSearchTerm])

  // 篩選夥伴
  const filteredPartners = useMemo(() => {
    // 如果有時段篩選，直接返回partners（已經在API層面篩選過了）
    if (debouncedFilterOptions.startDate && debouncedFilterOptions.endDate && 
        debouncedFilterOptions.startTime && debouncedFilterOptions.endTime) {
      return partners
    }
    
    // 沒有搜尋詞時不顯示任何夥伴
    if (!debouncedSearchTerm) return []
    
    const searchLower = debouncedSearchTerm.toLowerCase()
    return partners.filter(partner => 
      partner.name.toLowerCase().includes(searchLower) ||
      partner.games.some(game => game.toLowerCase().includes(searchLower))
    )
  }, [partners, debouncedSearchTerm, debouncedFilterOptions])

  const handleFilter = useCallback((startDate: string, endDate: string, game?: string, startTime?: string, endTime?: string) => {
    setFilterOptions({
      availableNow: false,
      rankBooster: false,
      startDate,
      endDate,
      startTime: startTime || '',
      endTime: endTime || ''
    })
    if (game) {
      setSearchTerm(game)
    }
  }, [])

  const handleQuickBook = useCallback((partnerId: string) => {
    router.push(`/booking?partnerId=${partnerId}`)
  }, [router])

  return (
    <div className="min-h-screen" style={{backgroundColor: '#E4E7EB'}}>

      {/* 超大 Hero Section */}
      <div className="relative py-32 px-8 overflow-hidden" style={{backgroundColor: '#E4E7EB'}}>
        <div className="relative z-10 max-w-8xl mx-auto text-center">
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black mb-12 text-gray-800">
            尋找遊戲夥伴
          </h1>
          <div className="w-48 h-3 mx-auto mb-12 rounded-full bg-blue-600"></div>
          <p className="text-2xl sm:text-3xl lg:text-4xl mb-16 max-w-5xl mx-auto font-bold text-gray-700">
            從專業的遊戲陪玩夥伴中選擇最適合您的一位
          </p>
          
          {/* 超大搜尋欄 */}
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              <input
                type="text"
                placeholder="搜尋遊戲或夥伴..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-12 py-10 rounded-3xl text-2xl focus:outline-none focus:ring-4 focus:ring-opacity-50 transition-all duration-500 group-hover:scale-105 font-black text-gray-800 placeholder-gray-500"
                style={{
                  backgroundColor: 'white',
                  border: '3px solid #E4E7EB',
                  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2)'
                }}
              />
              <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                <span className="text-4xl animate-pulse">🔍</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-20 px-8">
        <div className="max-w-8xl mx-auto">
          
          {/* 超大訊息提示 */}
          {message && (
            <div className={`mb-10 p-8 rounded-3xl text-center transition-all duration-300 ${
              message.includes('成功') 
                ? 'bg-green-50 text-green-700 border-2 border-green-200' 
                : 'bg-red-50 text-red-700 border-2 border-red-200'
            }`}>
              <div className="text-2xl font-black">{message}</div>
            </div>
          )}
          
          {/* 超大載入狀態 */}
          {loading && (
            <div className="text-center py-32">
              <div className="relative">
                <div className="w-32 h-32 mx-auto mb-12 rounded-full border-6 border-gray-200 border-t-#1A73E8 animate-spin"></div>
                <div className="text-3xl font-black" style={{color: '#333140'}}>載入夥伴資料中...</div>
              </div>
            </div>
          )}

          {/* 超大錯誤狀態 */}
          {error && (
            <div className="text-center py-32">
              <div className="max-w-lg mx-auto p-12 rounded-3xl" style={{backgroundColor: 'white', boxShadow: '0 16px 64px rgba(0, 0, 0, 0.1)'}}>
                <div className="text-9xl mb-8">⚠️</div>
                <h3 className="text-3xl font-black mb-6" style={{color: '#333140'}}>載入失敗</h3>
                <p className="text-xl mb-10" style={{color: '#333140', opacity: 0.8}}>{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-12 py-6 rounded-3xl font-black text-xl transition-all duration-500 hover:shadow-xl hover:scale-105 transform"
                  style={{
                    background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                    color: 'white'
                  }}
                >
                  重新載入
                </button>
              </div>
            </div>
          )}

          {/* 超大沒有結果 */}
          {!loading && !error && filteredPartners.length === 0 && (
            <div className="text-center py-32">
              <div className="max-w-xl mx-auto p-12 rounded-3xl" style={{backgroundColor: 'white', boxShadow: '0 16px 64px rgba(0, 0, 0, 0.1)'}}>
                <div className="text-9xl mb-8">🔍</div>
                <h3 className="text-3xl font-black mb-6" style={{color: '#333140'}}>
                  {searchTerm ? '搜尋無結果' : '請輸入搜尋條件來尋找夥伴'}
                </h3>
                {searchTerm && (
                  <>
                    <p className="text-xl mb-10" style={{color: '#333140', opacity: 0.8}}>
                      試試調整搜尋條件或清除搜尋
                    </p>
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="px-12 py-6 rounded-3xl font-black text-xl transition-all duration-500 hover:shadow-xl hover:scale-105 transform"
                      style={{
                        background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                        color: 'white'
                      }}
                    >
                      清除搜尋
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 夥伴列表 */}
          {!loading && !error && filteredPartners.length > 0 && (
            <>
              {/* 超大結果統計 */}
              <div className="mb-12 p-10 rounded-3xl" style={{backgroundColor: 'white', boxShadow: '0 12px 48px rgba(0, 0, 0, 0.1)'}}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-black" style={{color: '#333140'}}>
                      找到 {filteredPartners.length} 位夥伴
                    </h3>
                    <p className="text-lg font-bold" style={{color: '#333140', opacity: 0.7}}>
                      {searchTerm && `搜尋關鍵字: "${searchTerm}"`}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-4xl font-black" style={{color: '#1A73E8'}}>
                        {filteredPartners.length}
                      </div>
                      <div className="text-lg font-bold" style={{color: '#333140', opacity: 0.7}}>
                        可用夥伴
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 夥伴卡片網格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {filteredPartners.map(partner => (
                  <div key={partner.id} className="group">
                    <PartnerCard 
                      partner={partner} 
                      onQuickBook={handleQuickBook} 
                      showNextStep={true}
                      flipped={flippedCards.has(partner.id)}
                      onFlip={() => handleCardFlip(partner.id)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}