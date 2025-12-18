'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PartnerCard from '@/components/PartnerCard'
import PartnerHero from '@/components/PartnerHero'
import PartnerFilter from '@/components/PartnerFilter'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PartnerPageLayout from '@/components/partner/PartnerPageLayout'
import InfoCard from '@/components/partner/InfoCard'

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
          // API 返回格式可能是 { partners: [...], pagination: {...} } 或直接是數組
          const partnersArray = Array.isArray(data) ? data : (data?.partners || [])
          setPartners(partnersArray)
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
    <PartnerPageLayout
      title="尋找遊戲夥伴"
      subtitle="從專業的遊戲陪玩夥伴中選擇最適合您的一位"
      maxWidth="7xl"
    >
        {/* 搜尋欄 */}
        <div className="mb-8">
          <div className="relative group">
            <input
              type="text"
              placeholder="搜尋遊戲或夥伴..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-[#6C63FF] transition-all duration-300 text-gray-900 placeholder-gray-500 border border-gray-300 shadow-sm"
            />
            <div className="absolute right-6 top-1/2 transform -translate-y-1/2">
              <span className="text-2xl">🔍</span>
            </div>
          </div>
        </div>

        {/* 訊息提示 */}
        {message && (
          <InfoCard className={`mb-6 text-center ${
            message.includes('成功') 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-base font-medium ${
              message.includes('成功') ? 'text-green-800' : 'text-red-800'
            }`}>
              {message}
            </div>
          </InfoCard>
        )}
        
        {/* 載入狀態 */}
        {loading && (
          <div className="text-center py-16">
            <div className="relative">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-gray-200 border-t-[#6C63FF] animate-spin"></div>
              <div className="text-lg font-bold text-gray-900">載入夥伴資料中...</div>
            </div>
          </div>
        )}

        {/* 錯誤狀態 */}
        {error && (
          <InfoCard className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold mb-2 text-gray-900">載入失敗</h3>
            <p className="text-base mb-6 text-gray-600">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-[#6C63FF] text-white rounded-2xl hover:bg-[#5a52e6] transition-all duration-300 font-medium"
            >
              重新載入
            </button>
          </InfoCard>
        )}

        {/* 沒有結果 */}
        {!loading && !error && filteredPartners.length === 0 && (
          <InfoCard className="text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2 text-gray-900">
              {searchTerm ? '搜尋無結果' : '請輸入搜尋條件來尋找夥伴'}
            </h3>
            {searchTerm && (
              <>
                <p className="text-base mb-6 text-gray-600">
                  試試調整搜尋條件或清除搜尋
                </p>
                <button 
                  onClick={() => setSearchTerm('')}
                  className="px-6 py-3 bg-[#6C63FF] text-white rounded-2xl hover:bg-[#5a52e6] transition-all duration-300 font-medium"
                >
                  清除搜尋
                </button>
              </>
            )}
          </InfoCard>
        )}

        {/* 夥伴列表 */}
        {!loading && !error && filteredPartners.length > 0 && (
          <>
            {/* 結果統計 */}
            <InfoCard className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    找到 {filteredPartners.length} 位夥伴
                  </h3>
                  {searchTerm && (
                    <p className="text-sm text-gray-600 mt-1">
                      搜尋關鍵字: "{searchTerm}"
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#6C63FF]">
                    {filteredPartners.length}
                  </div>
                  <div className="text-sm text-gray-600">
                    可用夥伴
                  </div>
                </div>
              </div>
            </InfoCard>

            {/* 夥伴卡片網格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    </PartnerPageLayout>
  )
}