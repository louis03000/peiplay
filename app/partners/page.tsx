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
    <div className="min-h-screen bg-white">
      {/* 頂部橫幅 */}
      <div className="bg-white text-black py-4 border-b border-gray-200" style={{backgroundColor: 'white', color: 'black'}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center text-center">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="text-2xl font-bold text-black text-center" style={{color: 'black'}}>
                PeiPlay
              </Link>
            </div>
            
            {/* Navigation Links */}
            <div className="flex items-center space-x-12 text-center">
              <Link
                href="/booking"
                className="bg-white text-black border-2 border-black font-medium py-2 px-6 hover:bg-gray-100 transition-colors text-center"
                style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
              >
                預約
              </Link>
              <Link
                href="/ranking"
                className="bg-white text-black border-2 border-black font-medium py-2 px-6 hover:bg-gray-100 transition-colors text-center"
                style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
              >
                排行榜
              </Link>
              <Link
                href="/partners"
                className="bg-white text-black border-2 border-black font-medium py-2 px-6 hover:bg-gray-100 transition-colors text-center"
                style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
              >
                搜尋
              </Link>
              <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center ml-4">
                <span className="text-white text-sm font-bold">I</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg px-8 pt-6 pb-8 mb-4 border border-gray-200 max-w-4xl mx-auto text-center w-full">
          <h1 className="text-3xl font-bold text-black mb-6" style={{color: 'black'}}>遊戲夥伴</h1>
          <p className="text-lg text-black mb-8" style={{color: 'black'}}>找到最適合的遊戲夥伴，享受更好的遊戲體驗</p>
          
          <div className="mb-6">
            <input
              type="text"
              placeholder="搜尋夥伴姓名或遊戲..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border-2 border-black bg-white text-black"
              style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
            />
          </div>
          {message && (
            <div className={`text-center py-3 mb-4 rounded-lg ${message.includes('成功') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{message}</div>
          )}
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mb-4"></div>
              <p className="text-black" style={{color: 'black'}}>載入夥伴資料中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-black text-white border-2 border-black hover:bg-gray-800 transition-colors"
                style={{backgroundColor: 'black', color: 'white', borderColor: 'black'}}
              >
                重新載入
              </button>
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-black text-lg mb-4" style={{color: 'black'}}>
                {searchTerm ? '搜尋無結果' : '請輸入搜尋條件來尋找夥伴'}
              </p>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="bg-white text-black border-2 border-black px-4 py-2 hover:bg-gray-100 transition-colors"
                  style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
                >
                  清除搜尋
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 max-h-96 overflow-y-auto">
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