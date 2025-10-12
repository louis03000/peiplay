'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Navigation from '@/app/components/Navigation'

interface Review {
  id: string
  rating: number
  comment: string
  createdAt: string
  reviewerName: string
}

interface FeaturedPartner {
  id: string
  name: string
  games: string[]
  halfHourlyRate: number
  coverImage?: string
  rating: number
  totalBookings: number
}

interface GameRanking {
  name: string
  playerCount: number
  icon: string
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [featuredPartners, setFeaturedPartners] = useState<FeaturedPartner[]>([])
  const [gameRankings, setGameRankings] = useState<GameRanking[]>([])
  const [currentSection, setCurrentSection] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  // 滾動到指定區塊的函數
  const scrollToSection = useCallback((sectionIndex: number) => {
    if (!scrollContainerRef.current || isScrollingRef.current) return
    
    isScrollingRef.current = true
    const targetScrollTop = sectionIndex * window.innerHeight
    
    scrollContainerRef.current.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    })
    
    setCurrentSection(sectionIndex)
    
    // 重置滾動鎖定
    setTimeout(() => {
      isScrollingRef.current = false
    }, 1000)
  }, [])

  // 處理滾輪事件
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    if (isScrollingRef.current) return
    
    const delta = e.deltaY
    const sections = 4 // 總共4個區塊
    
    if (delta > 0 && currentSection < sections - 1) {
      // 向下滾動
      scrollToSection(currentSection + 1)
    } else if (delta < 0 && currentSection > 0) {
      // 向上滾動
      scrollToSection(currentSection - 1)
    }
  }, [currentSection, scrollToSection])

  useEffect(() => {
    // 如果用戶已登入但沒有完整資料，跳轉到 onboarding
    if (status === 'authenticated' && session?.user?.id) {
      // 檢查當前是否在 onboarding 頁面
      if (window.location.pathname === '/onboarding') {
        console.log('當前在 onboarding 頁面，跳過檢查')
        return
      }
      
      const checkUserProfile = async () => {
        try {
          const res = await fetch('/api/user/profile')
          console.log('檢查用戶資料，回應狀態:', res.status)
          
          if (res.ok) {
            const data = await res.json()
            const user = data.user
            console.log('用戶資料:', user)
            
            // 檢查是否有電話和生日
            const hasPhone = user.phone && user.phone.trim() !== ''
            const hasBirthday = user.birthday && user.birthday !== '2000-01-01'
            
            console.log('檢查結果:', { hasPhone, hasBirthday, phone: user.phone, birthday: user.birthday })
            
            // 如果用戶沒有電話或生日，視為新用戶
            if (!hasPhone || !hasBirthday) {
              console.log('新用戶，跳轉到 onboarding')
              router.push('/onboarding')
            } else {
              console.log('用戶資料完整，停留在首頁')
              // 用戶資料完整，不需要做任何跳轉，就停留在首頁
            }
          } else {
            console.error('獲取用戶資料失敗:', res.status)
          }
        } catch (error) {
          console.error('檢查用戶資料失敗:', error)
        }
      }
      
      checkUserProfile()
    }
  }, [session, status, router])

  // 獲取真實用戶評價
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch('/api/reviews/public')
        if (response.ok) {
          const data = await response.json()
          setReviews(data.reviews || [])
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error)
      }
    }
    
    fetchReviews()
  }, [])

  // 獲取精選夥伴
  useEffect(() => {
    const fetchFeaturedPartners = async () => {
      try {
        const response = await fetch('/api/partners?featured=true&limit=6')
        if (response.ok) {
          const data = await response.json()
          setFeaturedPartners(data.slice(0, 6))
        }
      } catch (error) {
        console.error('Failed to fetch featured partners:', error)
        // 設置默認數據
        setFeaturedPartners([
          {
            id: '1',
            name: '遊戲高手小陳',
            games: ['英雄聯盟', '特戰英豪'],
            halfHourlyRate: 150,
            rating: 4.9,
            totalBookings: 234
          },
          {
            id: '2',
            name: '電競女神小雨',
            games: ['Apex 英雄', 'CS:GO'],
            halfHourlyRate: 200,
            rating: 4.8,
            totalBookings: 189
          },
          {
            id: '3',
            name: '專業陪玩阿明',
            games: ['PUBG', '英雄聯盟'],
            halfHourlyRate: 120,
            rating: 4.7,
            totalBookings: 156
          }
        ])
      }
    }
    
    fetchFeaturedPartners()
  }, [])

  // 設置遊戲排行榜數據
  useEffect(() => {
    setGameRankings([
      { name: '英雄聯盟', playerCount: 2847, icon: '⚔️' },
      { name: '特戰英豪', playerCount: 1923, icon: '🎯' },
      { name: 'Apex 英雄', playerCount: 1654, icon: '🚀' },
      { name: 'CS:GO', playerCount: 1432, icon: '🔫' },
      { name: 'PUBG', playerCount: 987, icon: '🏃' }
    ])
  }, [])

  // 添加滾輪事件監聽器
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  return (
    <div className="min-h-screen overflow-hidden" style={{backgroundColor: '#E4E7EB'}}>
      <Navigation />

      {/* Hero Section - 主視覺焦點區 */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 背景漸層 */}
        <div className="absolute inset-0 bg-gradient-to-br from-#1A73E8 via-#5C7AD6 to-#1A73E8 opacity-90"></div>
        
        {/* 幾何裝飾元素 */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-white opacity-10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-white opacity-5 rounded-full blur-2xl"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-white opacity-20 rotate-45 blur-lg"></div>
        
        <div className="relative z-10 px-6 py-20 sm:py-24 lg:py-32 text-center max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold mb-6 leading-tight" style={{color: 'white'}}>
              PeiPlay
            </h1>
            <div className="w-24 h-1 mx-auto mb-8" style={{backgroundColor: '#5C7AD6'}}></div>
            <p className="text-2xl sm:text-3xl mb-8 max-w-4xl mx-auto font-light" style={{color: 'white', opacity: 0.95}}>
              專業遊戲陪玩平台
            </p>
            <p className="text-lg mb-12 max-w-3xl mx-auto leading-relaxed" style={{color: 'white', opacity: 0.9}}>
              連接優質遊戲夥伴，提供安全便捷的預約體驗。無論您是尋找陪玩服務，還是想成為專業陪玩夥伴，PeiPlay 都是您的最佳選擇。
            </p>
          </div>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <button
              onClick={() => router.push('/booking')}
              className="group px-12 py-5 rounded-2xl font-semibold text-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 transform"
              style={{
                background: 'linear-gradient(135deg, #00BFA5 0%, #1A73E8 100%)',
                color: 'white',
                boxShadow: '0 8px 32px rgba(0, 191, 165, 0.3)'
              }}
            >
              <span className="flex items-center gap-3">
                🎮 立即預約陪玩
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
            <button
              onClick={() => router.push('/join')}
              className="group px-12 py-5 rounded-2xl font-semibold text-xl border-2 transition-all duration-300 hover:shadow-2xl hover:scale-105 transform"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                borderColor: 'white',
                backdropFilter: 'blur(10px)'
              }}
            >
              <span className="flex items-center gap-3">
                💼 成為陪玩夥伴
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>

          {/* 快速搜尋 */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="搜尋遊戲或夥伴..."
                className="w-full px-8 py-5 rounded-2xl text-lg focus:outline-none focus:ring-4 focus:ring-opacity-50 transition-all duration-200 backdrop-blur-sm"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                }}
              />
              <div className="absolute right-6 top-1/2 transform -translate-y-1/2">
                <span className="text-2xl">🔍</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 功能 / 服務簡介區 */}
      <div className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold mb-8" style={{color: '#333140'}}>
              為什麼選擇 PeiPlay？
            </h2>
            <div className="w-24 h-1 mx-auto mb-8" style={{backgroundColor: '#1A73E8'}}></div>
            <p className="text-xl max-w-3xl mx-auto" style={{color: '#333140', opacity: 0.8}}>
              我們提供最專業、最安全的遊戲陪玩服務體驗
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature Card 1 */}
            <div className="group text-center p-8 rounded-3xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 transform" style={{backgroundColor: 'white'}}>
              <div className="w-20 h-20 mx-auto mb-8 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)'}}>
                <span className="text-3xl">🔒</span>
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{color: '#333140'}}>
                安全保證
              </h3>
              <p className="leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                嚴格的夥伴認證流程，確保每位夥伴都經過專業審核，為您提供安全可靠的服務體驗。
              </p>
            </div>
            
            {/* Feature Card 2 */}
            <div className="group text-center p-8 rounded-3xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 transform" style={{backgroundColor: 'white'}}>
              <div className="w-20 h-20 mx-auto mb-8 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{background: 'linear-gradient(135deg, #00BFA5 0%, #1A73E8 100%)'}}>
                <span className="text-3xl">⭐</span>
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{color: '#333140'}}>
                優質服務
              </h3>
              <p className="leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                專業的遊戲夥伴，豐富的遊戲經驗，為您提供高品質的陪玩服務和遊戲指導。
              </p>
            </div>
            
            {/* Feature Card 3 */}
            <div className="group text-center p-8 rounded-3xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 transform" style={{backgroundColor: 'white'}}>
              <div className="w-20 h-20 mx-auto mb-8 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{background: 'linear-gradient(135deg, #5C7AD6 0%, #00BFA5 100%)'}}>
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{color: '#333140'}}>
                客製體驗
              </h3>
              <p className="leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                根據您的需求匹配最適合的夥伴，提供個人化的遊戲體驗和專業建議。
              </p>
            </div>
            
            {/* Feature Card 4 */}
            <div className="group text-center p-8 rounded-3xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 transform" style={{backgroundColor: 'white'}}>
              <div className="w-20 h-20 mx-auto mb-8 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)'}}>
                <span className="text-3xl">⚡</span>
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{color: '#333140'}}>
                即時匹配
              </h3>
              <p className="leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                智能匹配系統，快速找到最適合的遊戲夥伴，享受流暢的預約體驗。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 熱門夥伴 / 推薦卡片展示 */}
      <div className="py-24 px-6" style={{backgroundColor: 'white'}}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold mb-8" style={{color: '#333140'}}>
              精選夥伴
            </h2>
            <div className="w-24 h-1 mx-auto mb-8" style={{backgroundColor: '#1A73E8'}}></div>
            <p className="text-xl max-w-3xl mx-auto" style={{color: '#333140', opacity: 0.8}}>
              專業認證的遊戲夥伴，為您提供最優質的陪玩服務
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredPartners.map((partner) => (
              <div key={partner.id} className="group rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 transform" style={{backgroundColor: 'white', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'}}>
                <div className="h-48 bg-gradient-to-br from-#1A73E8 to-#5C7AD6 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                    <span className="text-3xl">🎮</span>
                  </div>
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-4" style={{color: '#333140'}}>
                    {partner.name}
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {partner.games.map((game, index) => (
                      <span key={index} className="px-3 py-1 rounded-full text-sm" style={{backgroundColor: '#E4E7EB', color: '#333140'}}>
                        {game}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⭐</span>
                      <span className="text-lg font-semibold" style={{color: '#333140'}}>
                        {partner.rating}
                      </span>
                      <span className="text-sm" style={{color: '#333140', opacity: 0.7}}>
                        ({partner.totalBookings} 次預約)
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{color: '#1A73E8'}}>
                        ${partner.halfHourlyRate}
                      </div>
                      <div className="text-sm" style={{color: '#333140', opacity: 0.7}}>
                        每半小時
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/booking?partnerId=${partner.id}`)}
                    className="w-full py-4 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg transform hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                      color: 'white'
                    }}
                  >
                    立即預約
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <button
              onClick={() => router.push('/partners')}
              className="px-12 py-5 rounded-2xl font-semibold text-xl transition-all duration-300 hover:shadow-xl hover:scale-105 transform"
              style={{
                backgroundColor: 'transparent',
                color: '#1A73E8',
                border: '2px solid #1A73E8'
              }}
            >
              查看更多夥伴
            </button>
          </div>
        </div>
      </div>

      {/* 排行榜 / 熱門遊戲模塊 */}
      <div className="py-24 px-6" style={{backgroundColor: '#E4E7EB'}}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold mb-8" style={{color: '#333140'}}>
              熱門遊戲
            </h2>
            <div className="w-24 h-1 mx-auto mb-8" style={{backgroundColor: '#1A73E8'}}></div>
            <p className="text-xl max-w-3xl mx-auto" style={{color: '#333140', opacity: 0.8}}>
              看看大家都在玩什麼遊戲
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {gameRankings.map((game, index) => (
              <div key={game.name} className="group text-center p-8 rounded-3xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 transform" style={{backgroundColor: 'white'}}>
                <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  {game.icon}
                </div>
                <div className="text-3xl font-bold mb-2" style={{color: index < 3 ? '#1A73E8' : '#5C7AD6'}}>
                  #{index + 1}
                </div>
                <h3 className="text-xl font-semibold mb-4" style={{color: '#333140'}}>
                  {game.name}
                </h3>
                <div className="text-lg" style={{color: '#333140', opacity: 0.8}}>
                  {game.playerCount.toLocaleString()} 玩家
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 流程示意 / 如何運作區 */}
      <div className="py-24 px-6" style={{backgroundColor: 'white'}}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold mb-8" style={{color: '#333140'}}>
              如何使用 PeiPlay？
            </h2>
            <div className="w-24 h-1 mx-auto mb-8" style={{backgroundColor: '#1A73E8'}}></div>
            <p className="text-xl max-w-3xl mx-auto" style={{color: '#333140', opacity: 0.8}}>
              簡單三步驟，開始您的遊戲之旅
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-8 rounded-full flex items-center justify-center text-4xl font-bold" style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)', color: 'white'}}>
                1
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{color: '#333140'}}>
                選擇夥伴
              </h3>
              <p className="text-lg leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                從眾多專業認證的遊戲夥伴中，選擇最適合您的一位
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-8 rounded-full flex items-center justify-center text-4xl font-bold" style={{background: 'linear-gradient(135deg, #5C7AD6 0%, #00BFA5 100%)', color: 'white'}}>
                2
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{color: '#333140'}}>
                預約時段
              </h3>
              <p className="text-lg leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                選擇您方便的時間，確認預約詳情並完成付款
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-8 rounded-full flex items-center justify-center text-4xl font-bold" style={{background: 'linear-gradient(135deg, #00BFA5 0%, #1A73E8 100%)', color: 'white'}}>
                3
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{color: '#333140'}}>
                開始遊戲
              </h3>
              <p className="text-lg leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                在約定時間上線，享受專業的陪玩服務和遊戲指導
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 信任 / 保證 / 用戶評價區塊 */}
      <div className="py-24 px-6" style={{backgroundColor: '#E4E7EB'}}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold mb-8" style={{color: '#333140'}}>
              用戶評價
            </h2>
            <div className="w-24 h-1 mx-auto mb-8" style={{backgroundColor: '#1A73E8'}}></div>
            <p className="text-xl max-w-3xl mx-auto" style={{color: '#333140', opacity: 0.8}}>
              看看其他用戶對我們的評價
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {reviews.slice(0, 6).map((review) => (
              <div key={review.id} className="p-8 rounded-3xl transition-all duration-500 hover:shadow-xl hover:-translate-y-1 transform" style={{backgroundColor: 'white'}}>
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)', color: 'white'}}>
                    {review.reviewerName.charAt(0)}
                  </div>
                  <div className="ml-4">
                    <div className="font-semibold" style={{color: '#333140'}}>
                      {review.reviewerName}
                    </div>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400">
                          {i < review.rating ? '★' : '☆'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-lg leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                  "{review.comment}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Section - 數據展示區 */}
      <div className="py-20 px-6" style={{backgroundColor: 'white'}}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            <div className="group">
              <div className="text-5xl sm:text-6xl font-bold mb-4 group-hover:scale-110 transition-transform duration-300" style={{color: '#1A73E8'}}>
                500+
              </div>
              <div className="text-lg font-medium" style={{color: '#333140', opacity: 0.8}}>
                活躍夥伴
              </div>
            </div>
            <div className="group">
              <div className="text-5xl sm:text-6xl font-bold mb-4 group-hover:scale-110 transition-transform duration-300" style={{color: '#5C7AD6'}}>
                10,000+
              </div>
              <div className="text-lg font-medium" style={{color: '#333140', opacity: 0.8}}>
                成功預約
              </div>
            </div>
            <div className="group">
              <div className="text-5xl sm:text-6xl font-bold mb-4 group-hover:scale-110 transition-transform duration-300" style={{color: '#00BFA5'}}>
                4.9
              </div>
              <div className="text-lg font-medium" style={{color: '#333140', opacity: 0.8}}>
                用戶評價
              </div>
            </div>
            <div className="group">
              <div className="text-5xl sm:text-6xl font-bold mb-4 group-hover:scale-110 transition-transform duration-300" style={{color: '#1A73E8'}}>
                24/7
              </div>
              <div className="text-lg font-medium" style={{color: '#333140', opacity: 0.8}}>
                客服支援
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="py-24 px-6" style={{backgroundColor: '#E4E7EB'}}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-8" style={{color: '#333140'}}>
            準備開始您的遊戲之旅？
          </h2>
          <p className="text-xl mb-12" style={{color: '#333140', opacity: 0.8}}>
            立即預約專業陪玩夥伴，享受優質的遊戲體驗
          </p>
          <button
            onClick={() => router.push('/booking')}
            className="px-16 py-6 rounded-2xl font-semibold text-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 transform"
            style={{
              background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(26, 115, 232, 0.3)'
            }}
          >
            開始預約
          </button>
        </div>
      </div>
    </div>
  )
}