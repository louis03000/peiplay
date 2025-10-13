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
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // 滑鼠追蹤效果
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

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

      {/* 超大 Hero Section - 真正的視覺焦點 */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 動態背景漸層 */}
        <div className="absolute inset-0 bg-gradient-to-br from-#1A73E8 via-#5C7AD6 to-#1A73E8 opacity-95"></div>
        
        {/* 動態幾何裝飾元素 */}
        <div 
          className="absolute top-20 left-10 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl transition-all duration-1000"
          style={{
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`
          }}
        ></div>
        <div 
          className="absolute bottom-20 right-10 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl transition-all duration-1000"
          style={{
            transform: `translate(${mousePosition.x * -0.01}px, ${mousePosition.y * -0.01}px)`
          }}
        ></div>
        <div 
          className="absolute top-1/2 left-1/4 w-24 h-24 bg-white opacity-20 rotate-45 blur-xl transition-all duration-1000"
          style={{
            transform: `translate(${mousePosition.x * 0.03}px, ${mousePosition.y * 0.03}px) rotate(45deg)`
          }}
        ></div>
        
        {/* 浮動遊戲圖標 */}
        <div className="absolute top-1/4 right-1/4 text-8xl opacity-20 animate-bounce" style={{animationDelay: '0s'}}>🎮</div>
        <div className="absolute bottom-1/3 left-1/3 text-6xl opacity-15 animate-bounce" style={{animationDelay: '1s'}}>⚔️</div>
        <div className="absolute top-1/3 left-1/5 text-5xl opacity-20 animate-bounce" style={{animationDelay: '2s'}}>🎯</div>
        <div className="absolute bottom-1/4 right-1/3 text-7xl opacity-15 animate-bounce" style={{animationDelay: '3s'}}>🚀</div>
        
        <div className="relative z-10 px-8 py-24 sm:py-32 lg:py-40 text-center max-w-8xl mx-auto">
          <div className="mb-16">
            {/* 超大動態標題 */}
            <div className="mb-12">
              <h1 className="text-8xl sm:text-9xl lg:text-[12rem] font-black mb-12 leading-none" style={{
                color: 'white',
                textShadow: '4px 4px 8px rgba(0,0,0,0.3)',
                background: 'linear-gradient(45deg, #ffffff, #00BFA5, #ffffff)',
                backgroundSize: '200% 200%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'shimmer 3s ease-in-out infinite'
              }}>
                <span className="inline-block animate-pulse">Pei</span>
                <span className="inline-block animate-bounce" style={{animationDelay: '0.5s'}}>Play</span>
              </h1>
              <div className="w-48 h-3 mx-auto mb-12 rounded-full" style={{
                background: 'linear-gradient(90deg, #00BFA5, #5C7AD6, #1A73E8, #00BFA5)',
                animation: 'shimmer 4s infinite'
              }}></div>
            </div>
            
            {/* 超大吸引人副標題 */}
            <div className="mb-16">
              <p className="text-4xl sm:text-5xl lg:text-6xl mb-8 max-w-6xl mx-auto font-black" style={{
                color: 'white',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                opacity: 0.98
              }}>
                專業遊戲陪玩平台
              </p>
              <p className="text-2xl sm:text-3xl lg:text-4xl mb-12 max-w-5xl mx-auto leading-relaxed font-bold" style={{
                color: 'white',
                textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                opacity: 0.95
              }}>
                連接優質遊戲夥伴，提供安全便捷的預約體驗。無論您是尋找陪玩服務，還是想成為專業陪玩夥伴，PeiPlay 都是您的最佳選擇。
              </p>
            </div>
          </div>
          
          {/* 超大 CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-8 justify-center items-center mb-20">
            <button
              onClick={() => router.push('/booking')}
              className="group px-20 py-8 rounded-3xl font-black text-3xl transition-all duration-500 hover:shadow-2xl hover:scale-110 transform"
              style={{
                background: 'linear-gradient(135deg, #00BFA5 0%, #1A73E8 100%)',
                color: 'white',
                boxShadow: '0 16px 48px rgba(0, 191, 165, 0.5)',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                animation: 'pulse 2s infinite'
              }}
            >
              <span className="flex items-center gap-4">
                🎮 立即預約陪玩
                <svg className="w-8 h-8 group-hover:translate-x-3 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
            <button
              onClick={() => router.push('/join')}
              className="group px-20 py-8 rounded-3xl font-black text-3xl border-4 transition-all duration-500 hover:shadow-2xl hover:scale-110 transform"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: 'white',
                borderColor: 'white',
                backdropFilter: 'blur(20px)',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              <span className="flex items-center gap-4">
                💼 成為陪玩夥伴
                <svg className="w-8 h-8 group-hover:translate-x-3 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>

          {/* 超大搜尋欄 */}
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              <input
                type="text"
                placeholder="搜尋遊戲或夥伴..."
                className="w-full px-12 py-10 rounded-3xl text-2xl focus:outline-none focus:ring-4 focus:ring-opacity-50 transition-all duration-500 group-hover:scale-105 font-bold"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  color: 'white',
                  border: '3px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2)',
                  backdropFilter: 'blur(15px)',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                }}
              />
              <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                <span className="text-4xl animate-pulse">🔍</span>
              </div>
            </div>
          </div>

          {/* 滾動指示器 */}
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 animate-bounce">
            <div className="w-8 h-12 border-3 border-white rounded-full flex justify-center">
              <div className="w-2 h-4 bg-white rounded-full mt-2 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 超大功能 / 服務簡介區 */}
      <div className="py-40 px-8 relative">
        {/* 背景裝飾 */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-5"></div>
        
        <div className="max-w-8xl mx-auto relative z-10">
          <div className="text-center mb-32">
            <h2 className="text-6xl sm:text-7xl lg:text-8xl font-black mb-12" style={{color: '#333140'}}>
              為什麼選擇 PeiPlay？
            </h2>
            <div className="w-48 h-3 mx-auto mb-12 rounded-full" style={{
              background: 'linear-gradient(90deg, #1A73E8, #5C7AD6, #00BFA5)'
            }}></div>
            <p className="text-3xl max-w-5xl mx-auto font-bold" style={{color: '#333140', opacity: 0.8}}>
              我們提供最專業、最安全的遊戲陪玩服務體驗
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* 超大 Feature Card 1 */}
            <div className="group text-center p-12 rounded-3xl transition-all duration-700 hover:shadow-2xl hover:-translate-y-6 transform" style={{backgroundColor: 'white', boxShadow: '0 12px 48px rgba(0, 0, 0, 0.1)'}}>
              <div className="w-32 h-32 mx-auto mb-12 rounded-3xl flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 shadow-xl" style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)'}}>
                <span className="text-6xl">🔒</span>
              </div>
              <h3 className="text-3xl font-black mb-8" style={{color: '#333140'}}>
                安全保證
              </h3>
              <p className="leading-relaxed text-xl font-medium" style={{color: '#333140', opacity: 0.8}}>
                嚴格的夥伴認證流程，確保每位夥伴都經過專業審核，為您提供安全可靠的服務體驗。
              </p>
            </div>
            
            {/* 超大 Feature Card 2 */}
            <div className="group text-center p-12 rounded-3xl transition-all duration-700 hover:shadow-2xl hover:-translate-y-6 transform" style={{backgroundColor: 'white', boxShadow: '0 12px 48px rgba(0, 0, 0, 0.1)'}}>
              <div className="w-32 h-32 mx-auto mb-12 rounded-3xl flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 shadow-xl" style={{background: 'linear-gradient(135deg, #00BFA5 0%, #1A73E8 100%)'}}>
                <span className="text-6xl">⭐</span>
              </div>
              <h3 className="text-3xl font-black mb-8" style={{color: '#333140'}}>
                優質服務
              </h3>
              <p className="leading-relaxed text-xl font-medium" style={{color: '#333140', opacity: 0.8}}>
                專業的遊戲夥伴，豐富的遊戲經驗，為您提供高品質的陪玩服務和遊戲指導。
              </p>
            </div>
            
            {/* 超大 Feature Card 3 */}
            <div className="group text-center p-12 rounded-3xl transition-all duration-700 hover:shadow-2xl hover:-translate-y-6 transform" style={{backgroundColor: 'white', boxShadow: '0 12px 48px rgba(0, 0, 0, 0.1)'}}>
              <div className="w-32 h-32 mx-auto mb-12 rounded-3xl flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 shadow-xl" style={{background: 'linear-gradient(135deg, #5C7AD6 0%, #00BFA5 100%)'}}>
                <span className="text-6xl">🎯</span>
              </div>
              <h3 className="text-3xl font-black mb-8" style={{color: '#333140'}}>
                客製體驗
              </h3>
              <p className="leading-relaxed text-xl font-medium" style={{color: '#333140', opacity: 0.8}}>
                根據您的需求匹配最適合的夥伴，提供個人化的遊戲體驗和專業建議。
              </p>
            </div>
            
            {/* 超大 Feature Card 4 */}
            <div className="group text-center p-12 rounded-3xl transition-all duration-700 hover:shadow-2xl hover:-translate-y-6 transform" style={{backgroundColor: 'white', boxShadow: '0 12px 48px rgba(0, 0, 0, 0.1)'}}>
              <div className="w-32 h-32 mx-auto mb-12 rounded-3xl flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 shadow-xl" style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)'}}>
                <span className="text-6xl">⚡</span>
              </div>
              <h3 className="text-3xl font-black mb-8" style={{color: '#333140'}}>
                即時匹配
              </h3>
              <p className="leading-relaxed text-xl font-medium" style={{color: '#333140', opacity: 0.8}}>
                智能匹配系統，快速找到最適合的遊戲夥伴，享受流暢的預約體驗。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 超大熱門夥伴 / 推薦卡片展示 */}
      <div className="py-40 px-8" style={{backgroundColor: 'white'}}>
        <div className="max-w-8xl mx-auto">
          <div className="text-center mb-32">
            <h2 className="text-6xl sm:text-7xl lg:text-8xl font-black mb-12" style={{color: '#333140'}}>
              精選夥伴
            </h2>
            <div className="w-48 h-3 mx-auto mb-12 rounded-full" style={{
              background: 'linear-gradient(90deg, #1A73E8, #5C7AD6, #00BFA5)'
            }}></div>
            <p className="text-3xl max-w-5xl mx-auto font-bold" style={{color: '#333140', opacity: 0.8}}>
              專業認證的遊戲夥伴，為您提供最優質的陪玩服務
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {featuredPartners.map((partner, index) => (
              <div key={partner.id} className="group rounded-3xl overflow-hidden transition-all duration-700 hover:shadow-2xl hover:-translate-y-6 transform" 
                   style={{backgroundColor: 'white', boxShadow: '0 16px 64px rgba(0, 0, 0, 0.1)'}}>
                <div className="h-72 bg-gradient-to-br from-#1A73E8 to-#5C7AD6 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-black opacity-20 group-hover:opacity-0 transition-opacity duration-500"></div>
                  <div className="w-32 h-32 rounded-full bg-white bg-opacity-20 flex items-center justify-center group-hover:scale-125 transition-transform duration-500">
                    <span className="text-6xl">🎮</span>
                  </div>
                  {/* 排名徽章 */}
                  <div className="absolute top-6 left-6 w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-xl" 
                       style={{background: index < 3 ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'linear-gradient(135deg, #1A73E8, #5C7AD6)'}}>
                    {index + 1}
                  </div>
                </div>
                <div className="p-10">
                  <h3 className="text-3xl font-black mb-6" style={{color: '#333140'}}>
                    {partner.name}
                  </h3>
                  <div className="flex flex-wrap gap-3 mb-8">
                    {partner.games.map((game, gameIndex) => (
                      <span key={gameIndex} className="px-5 py-3 rounded-full text-lg font-bold" style={{backgroundColor: '#E4E7EB', color: '#333140'}}>
                        {game}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">⭐</span>
                      <span className="text-2xl font-black" style={{color: '#333140'}}>
                        {partner.rating}
                      </span>
                      <span className="text-lg font-medium" style={{color: '#333140', opacity: 0.7}}>
                        ({partner.totalBookings} 次預約)
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black" style={{color: '#1A73E8'}}>
                        ${partner.halfHourlyRate}
                      </div>
                      <div className="text-lg font-medium" style={{color: '#333140', opacity: 0.7}}>
                        每半小時
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/booking?partnerId=${partner.id}`)}
                    className="w-full py-6 rounded-3xl font-black text-xl transition-all duration-500 hover:shadow-xl hover:scale-105 transform"
                    style={{
                      background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                      color: 'white',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                    }}
                  >
                    立即預約
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-20">
            <button
              onClick={() => router.push('/partners')}
              className="px-20 py-8 rounded-3xl font-black text-2xl transition-all duration-500 hover:shadow-xl hover:scale-105 transform border-4"
              style={{
                backgroundColor: 'transparent',
                color: '#1A73E8',
                borderColor: '#1A73E8'
              }}
            >
              查看更多夥伴
            </button>
          </div>
        </div>
      </div>

      {/* 超大排行榜 / 熱門遊戲模塊 */}
      <div className="py-40 px-8" style={{backgroundColor: '#E4E7EB'}}>
        <div className="max-w-8xl mx-auto">
          <div className="text-center mb-32">
            <h2 className="text-6xl sm:text-7xl lg:text-8xl font-black mb-12" style={{color: '#333140'}}>
              熱門遊戲
            </h2>
            <div className="w-48 h-3 mx-auto mb-12 rounded-full" style={{
              background: 'linear-gradient(90deg, #1A73E8, #5C7AD6, #00BFA5)'
            }}></div>
            <p className="text-3xl max-w-5xl mx-auto font-bold" style={{color: '#333140', opacity: 0.8}}>
              看看大家都在玩什麼遊戲
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
            {gameRankings.map((game, index) => (
              <div key={game.name} className="group text-center p-12 rounded-3xl transition-all duration-700 hover:shadow-2xl hover:-translate-y-6 transform" 
                   style={{backgroundColor: 'white', boxShadow: '0 16px 64px rgba(0, 0, 0, 0.1)'}}>
                <div className="text-9xl mb-10 group-hover:scale-125 transition-transform duration-500">
                  {game.icon}
                </div>
                <div className="text-5xl font-black mb-6" style={{color: index < 3 ? '#1A73E8' : '#5C7AD6'}}>
                  #{index + 1}
                </div>
                <h3 className="text-3xl font-black mb-8" style={{color: '#333140'}}>
                  {game.name}
                </h3>
                <div className="text-2xl font-bold" style={{color: '#333140', opacity: 0.8}}>
                  {game.playerCount.toLocaleString()} 玩家
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 超大流程示意 / 如何運作區 */}
      <div className="py-40 px-8" style={{backgroundColor: 'white'}}>
        <div className="max-w-8xl mx-auto">
          <div className="text-center mb-32">
            <h2 className="text-6xl sm:text-7xl lg:text-8xl font-black mb-12" style={{color: '#333140'}}>
              如何使用 PeiPlay？
            </h2>
            <div className="w-48 h-3 mx-auto mb-12 rounded-full" style={{
              background: 'linear-gradient(90deg, #1A73E8, #5C7AD6, #00BFA5)'
            }}></div>
            <p className="text-3xl max-w-5xl mx-auto font-bold" style={{color: '#333140', opacity: 0.8}}>
              簡單三步驟，開始您的遊戲之旅
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
            <div className="text-center group">
              <div className="w-40 h-40 mx-auto mb-12 rounded-3xl flex items-center justify-center text-6xl font-black transition-all duration-700 group-hover:scale-125 group-hover:rotate-12 transform" 
                   style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)', color: 'white'}}>
                1
              </div>
              <h3 className="text-4xl font-black mb-10" style={{color: '#333140'}}>
                選擇夥伴
              </h3>
              <p className="text-2xl leading-relaxed font-medium" style={{color: '#333140', opacity: 0.8}}>
                從眾多專業認證的遊戲夥伴中，選擇最適合您的一位
              </p>
            </div>
            
            <div className="text-center group">
              <div className="w-40 h-40 mx-auto mb-12 rounded-3xl flex items-center justify-center text-6xl font-black transition-all duration-700 group-hover:scale-125 group-hover:rotate-12 transform" 
                   style={{background: 'linear-gradient(135deg, #5C7AD6 0%, #00BFA5 100%)', color: 'white'}}>
                2
              </div>
              <h3 className="text-4xl font-black mb-10" style={{color: '#333140'}}>
                預約時段
              </h3>
              <p className="text-2xl leading-relaxed font-medium" style={{color: '#333140', opacity: 0.8}}>
                選擇您方便的時間，確認預約詳情並完成付款
              </p>
            </div>
            
            <div className="text-center group">
              <div className="w-40 h-40 mx-auto mb-12 rounded-3xl flex items-center justify-center text-6xl font-black transition-all duration-700 group-hover:scale-125 group-hover:rotate-12 transform" 
                   style={{background: 'linear-gradient(135deg, #00BFA5 0%, #1A73E8 100%)', color: 'white'}}>
                3
              </div>
              <h3 className="text-4xl font-black mb-10" style={{color: '#333140'}}>
                開始遊戲
              </h3>
              <p className="text-2xl leading-relaxed font-medium" style={{color: '#333140', opacity: 0.8}}>
                在約定時間上線，享受專業的陪玩服務和遊戲指導
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 超大信任 / 保證 / 用戶評價區塊 */}
      <div className="py-40 px-8" style={{backgroundColor: '#E4E7EB'}}>
        <div className="max-w-8xl mx-auto">
          <div className="text-center mb-32">
            <h2 className="text-6xl sm:text-7xl lg:text-8xl font-black mb-12" style={{color: '#333140'}}>
              用戶評價
            </h2>
            <div className="w-48 h-3 mx-auto mb-12 rounded-full" style={{
              background: 'linear-gradient(90deg, #1A73E8, #5C7AD6, #00BFA5)'
            }}></div>
            <p className="text-3xl max-w-5xl mx-auto font-bold" style={{color: '#333140', opacity: 0.8}}>
              看看其他用戶對我們的評價
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {reviews.slice(0, 6).map((review) => (
              <div key={review.id} className="p-12 rounded-3xl transition-all duration-700 hover:shadow-2xl hover:-translate-y-4 transform" 
                   style={{backgroundColor: 'white', boxShadow: '0 16px 64px rgba(0, 0, 0, 0.1)'}}>
                <div className="flex items-center mb-10">
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black" 
                       style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)', color: 'white'}}>
                    {review.reviewerName.charAt(0)}
                  </div>
                  <div className="ml-8">
                    <div className="text-2xl font-black" style={{color: '#333140'}}>
                      {review.reviewerName}
                    </div>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-2xl">
                          {i < review.rating ? '★' : '☆'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-2xl leading-relaxed font-medium" style={{color: '#333140', opacity: 0.8}}>
                  "{review.comment}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 超大數據展示區 */}
      <div className="py-32 px-8" style={{backgroundColor: 'white'}}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-20 text-center">
            <div className="group">
              <div className="text-7xl sm:text-8xl font-black mb-8 group-hover:scale-125 transition-transform duration-500" style={{color: '#1A73E8'}}>
                500+
              </div>
              <div className="text-2xl font-bold" style={{color: '#333140', opacity: 0.8}}>
                活躍夥伴
              </div>
            </div>
            <div className="group">
              <div className="text-7xl sm:text-8xl font-black mb-8 group-hover:scale-125 transition-transform duration-500" style={{color: '#5C7AD6'}}>
                10,000+
              </div>
              <div className="text-2xl font-bold" style={{color: '#333140', opacity: 0.8}}>
                成功預約
              </div>
            </div>
            <div className="group">
              <div className="text-7xl sm:text-8xl font-black mb-8 group-hover:scale-125 transition-transform duration-500" style={{color: '#00BFA5'}}>
                4.9
              </div>
              <div className="text-2xl font-bold" style={{color: '#333140', opacity: 0.8}}>
                用戶評價
              </div>
            </div>
            <div className="group">
              <div className="text-7xl sm:text-8xl font-black mb-8 group-hover:scale-125 transition-transform duration-500" style={{color: '#1A73E8'}}>
                24/7
              </div>
              <div className="text-2xl font-bold" style={{color: '#333140', opacity: 0.8}}>
                客服支援
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 超大 Final CTA Section */}
      <div className="py-40 px-8" style={{backgroundColor: '#E4E7EB'}}>
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-6xl sm:text-7xl lg:text-8xl font-black mb-12" style={{color: '#333140'}}>
            準備開始您的遊戲之旅？
          </h2>
          <p className="text-3xl mb-20 font-bold" style={{color: '#333140', opacity: 0.8}}>
            立即預約專業陪玩夥伴，享受優質的遊戲體驗
          </p>
          <button
            onClick={() => router.push('/booking')}
            className="px-24 py-10 rounded-3xl font-black text-3xl transition-all duration-500 hover:shadow-2xl hover:scale-110 transform"
            style={{
              background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
              color: 'white',
              boxShadow: '0 16px 48px rgba(26, 115, 232, 0.4)',
              animation: 'pulse 2s infinite',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            開始預約
          </button>
        </div>
      </div>

      {/* CSS 動畫 */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}