'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Navigation from '@/components/Navigation'

interface Review {
  id: string
  rating: number
  comment: string
  createdAt: string
  reviewerName: string
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
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
    <div className="min-h-screen" style={{backgroundColor: '#E4E7EB'}}>
      <Navigation />

      {/* Hero Section - 主視覺焦點區 */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-#1A73E8 to-#00BFA5 opacity-90"></div>
        <div className="relative z-10 px-6 py-20 sm:py-24 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6" style={{color: 'white'}}>
              PeiPlay
            </h1>
            <p className="text-xl sm:text-2xl mb-8 max-w-2xl mx-auto" style={{color: 'white', opacity: 0.95}}>
              專業遊戲陪玩平台
            </p>
            <p className="text-lg mb-12 max-w-3xl mx-auto leading-relaxed" style={{color: 'white', opacity: 0.9}}>
              連接優質遊戲夥伴，提供安全便捷的預約體驗。無論您是尋找陪玩服務，還是想成為專業陪玩夥伴，PeiPlay 都是您的最佳選擇。
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => router.push('/booking')}
                className="px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:shadow-xl hover:scale-105"
                style={{
                  backgroundColor: '#00BFA5',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(0, 191, 165, 0.3)'
                }}
              >
                🎮 立即預約陪玩
              </button>
              <button
                onClick={() => router.push('/join')}
                className="px-8 py-4 rounded-lg font-semibold text-lg border-2 transition-all duration-300 hover:shadow-xl hover:scale-105"
                style={{
                  backgroundColor: 'transparent',
                  color: 'white',
                  borderColor: 'white'
                }}
              >
                💼 成為陪玩夥伴
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section - 功能介紹區 */}
      <div className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{color: '#333140'}}>
              為什麼選擇 PeiPlay？
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{color: '#333140', opacity: 0.8}}>
              我們提供最專業、最安全的遊戲陪玩服務體驗
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature Card 1 */}
            <div className="text-center p-8 rounded-xl transition-all duration-300 hover:shadow-xl" style={{backgroundColor: 'white'}}>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{backgroundColor: '#1A73E8'}}>
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold mb-4" style={{color: '#333140'}}>
                安全保證
              </h3>
              <p className="leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                嚴格的夥伴認證流程，確保每位夥伴都經過專業審核，為您提供安全可靠的服務體驗。
              </p>
            </div>
            
            {/* Feature Card 2 */}
            <div className="text-center p-8 rounded-xl transition-all duration-300 hover:shadow-xl" style={{backgroundColor: 'white'}}>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{backgroundColor: '#00BFA5'}}>
                <span className="text-2xl">⭐</span>
              </div>
              <h3 className="text-xl font-semibold mb-4" style={{color: '#333140'}}>
                優質服務
              </h3>
              <p className="leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                專業的遊戲夥伴，豐富的遊戲經驗，為您提供高品質的陪玩服務和遊戲指導。
              </p>
            </div>
            
            {/* Feature Card 3 */}
            <div className="text-center p-8 rounded-xl transition-all duration-300 hover:shadow-xl" style={{backgroundColor: 'white'}}>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{backgroundColor: '#1A73E8'}}>
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-xl font-semibold mb-4" style={{color: '#333140'}}>
                客製體驗
              </h3>
              <p className="leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                根據您的需求匹配最適合的夥伴，提供個人化的遊戲體驗和專業建議。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section - 數據展示區 */}
      <div className="py-16 px-6" style={{backgroundColor: 'white'}}>
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold mb-2" style={{color: '#1A73E8'}}>
                500+
              </div>
              <div className="text-sm font-medium" style={{color: '#333140', opacity: 0.8}}>
                活躍夥伴
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold mb-2" style={{color: '#00BFA5'}}>
                10,000+
              </div>
              <div className="text-sm font-medium" style={{color: '#333140', opacity: 0.8}}>
                成功預約
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold mb-2" style={{color: '#1A73E8'}}>
                4.9
              </div>
              <div className="text-sm font-medium" style={{color: '#333140', opacity: 0.8}}>
                用戶評價
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold mb-2" style={{color: '#00BFA5'}}>
                24/7
              </div>
              <div className="text-sm font-medium" style={{color: '#333140', opacity: 0.8}}>
                客服支援
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{color: '#333140'}}>
            準備開始您的遊戲之旅？
          </h2>
          <p className="text-lg mb-8" style={{color: '#333140', opacity: 0.8}}>
            立即預約專業陪玩夥伴，享受優質的遊戲體驗
          </p>
          <button
            onClick={() => router.push('/booking')}
            className="px-10 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:shadow-xl hover:scale-105"
            style={{
              backgroundColor: '#00BFA5',
              color: 'white',
              boxShadow: '0 4px 20px rgba(0, 191, 165, 0.3)'
            }}
          >
            開始預約
          </button>
        </div>
      </div>
    </div>
  )
}

