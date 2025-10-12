'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PartnerCard from '@/components/PartnerCard'
import PartnerHero from '@/components/PartnerHero'
import PartnerFilter from '@/components/PartnerFilter'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navigation from '@/components/Navigation'

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
      <Navigation />

      {/* Header Section */}
      <div className="py-16 px-6" style={{backgroundColor: '#1A73E8'}}>
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-6" style={{color: 'white'}}>
            尋找遊戲夥伴
          </h1>
          <p className="text-lg mb-8" style={{color: 'white', opacity: 0.9}}>
            從專業的遊戲陪玩夥伴中選擇最適合您的一位
          </p>
          
          {/* 搜尋欄 */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="搜尋遊戲或夥伴..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-6 py-4 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-opacity-50 transition-all duration-200"
                style={{
                  backgroundColor: 'white',
                  color: '#333140',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                }}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <span className="text-2xl">🔍</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          
          {/* 訊息提示 */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl text-center ${
              message.includes('成功') 
                ? 'bg-green-50 text-green-700' 
                : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}
          
          {/* 載入狀態 */}
          {loading && (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{borderColor: '#1A73E8'}}></div>
              <p className="text-lg" style={{color: '#333140'}}>載入夥伴資料中...</p>
            </div>
          )}

          {/* 錯誤狀態 */}
          {error && (
            <div className="text-center py-16">
              <div className="max-w-md mx-auto p-6 rounded-xl mb-6" style={{backgroundColor: 'white', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'}}>
                <div className="text-6xl mb-4">⚠️</div>
                <p className="text-lg mb-4" style={{color: '#333140'}}>{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg"
                  style={{
                    backgroundColor: '#00BFA5',
                    color: 'white'
                  }}
                >
                  重新載入
                </button>
              </div>
            </div>
          )}

          {/* 沒有結果 */}
          {!loading && !error && filteredPartners.length === 0 && (
            <div className="text-center py-16">
              <div className="max-w-md mx-auto p-6 rounded-xl" style={{backgroundColor: 'white', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'}}>
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-4" style={{color: '#333140'}}>
                  {searchTerm ? '搜尋無結果' : '請輸入搜尋條件來尋找夥伴'}
                </h3>
                {searchTerm && (
                  <>
                    <p className="mb-6" style={{color: '#333140', opacity: 0.8}}>
                      試試調整搜尋條件或清除搜尋
                    </p>
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg"
                      style={{
                        backgroundColor: '#1A73E8',
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          )}
        </div>
      </div>
    </div>
  )
} 