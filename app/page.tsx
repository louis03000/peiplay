'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'

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
    <div 
      ref={scrollContainerRef}
      className="overflow-y-scroll h-screen hide-scrollbar smooth-scroll optimized-scroll"
    >
      {/* Navigation - 功能欄橫欄 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-800 to-indigo-900 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="text-2xl font-bold text-white">
                PeiPlay
              </Link>
            </div>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/booking"
                className="text-white text-lg font-medium hover:text-gray-200 transition-colors"
              >
                預約
              </Link>
              <Link
                href="/ranking"
                className="text-white text-lg font-medium hover:text-gray-200 transition-colors"
              >
                排行榜
              </Link>
              <Link
                href="/partners"
                className="text-white text-lg font-medium hover:text-gray-200 transition-colors"
              >
                搜尋
              </Link>
              <Link
                href="/join"
                className="text-white text-lg font-medium hover:text-gray-200 transition-colors"
              >
                加入我們
              </Link>
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center ml-2">
                <span className="text-white text-sm font-bold">0</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - 第一屏 */}
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-purple-600 to-indigo-900 pt-16">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6">
              PeiPlay
            </h1>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              高品質遊戲陪玩平台
            </h2>
            <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-4xl mx-auto leading-relaxed">
              專業遊戲夥伴，安全預約系統，為您提供最優質的遊戲體驗。
              無論您是想找人陪玩，還是成為專業陪玩夥伴，PeiPlay 都是您的最佳選擇。
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <button
                onClick={() => router.push('/booking')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-5 px-10 rounded-xl text-xl shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-3"
              >
                🎮 立即預約陪玩
              </button>
              <button
                onClick={() => router.push('/join')}
                className="bg-white text-purple-600 hover:bg-gray-50 font-bold py-5 px-10 rounded-xl text-xl shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-3"
              >
                💼 成為陪玩夥伴
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* How It Works Section - 第二屏 */}
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-purple-600 to-indigo-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold text-white mb-6">
              如何使用 PeiPlay？
            </h3>
            <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
              簡單三步驟，立即開始您的遊戲陪玩體驗
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-full w-24 h-24 flex items-center justify-center text-white font-bold text-3xl mx-auto mb-8 shadow-lg">
                1
              </div>
              <h4 className="text-2xl font-bold text-white mb-6">選擇夥伴</h4>
              <p className="text-lg text-white/80 leading-relaxed">
                瀏覽我們的專業遊戲夥伴，根據遊戲類型、評價和價格選擇最適合的夥伴
              </p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-full w-24 h-24 flex items-center justify-center text-white font-bold text-3xl mx-auto mb-8 shadow-lg">
                2
              </div>
              <h4 className="text-2xl font-bold text-white mb-6">預約時間</h4>
              <p className="text-lg text-white/80 leading-relaxed">
                選擇您方便的時間，系統會自動創建 Discord 頻道讓您與夥伴溝通
              </p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-full w-24 h-24 flex items-center justify-center text-white font-bold text-3xl mx-auto mb-8 shadow-lg">
                3
              </div>
              <h4 className="text-2xl font-bold text-white mb-6">開始遊戲</h4>
              <p className="text-lg text-white/80 leading-relaxed">
                在預約時間進入語音頻道，與夥伴一起享受精彩的遊戲時光
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* User Testimonials Section - 第三屏 */}
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-purple-600 to-indigo-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold text-white mb-6">
              用戶見證
            </h3>
            <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
              看看其他用戶對 PeiPlay 的評價
            </p>
          </div>

          {reviews.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-8">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-white/20">
                  <div className="flex items-center mb-6">
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                          ⭐
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-white mb-6 text-lg">
                    "{review.comment}"
                  </p>
                  <div className="text-white font-semibold text-lg">- {review.reviewerName}</div>
                  <div className="text-sm text-white/60 mt-2">
                    {new Date(review.createdAt).toLocaleDateString('zh-TW')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-white/90 text-xl mb-12">
                目前還沒有用戶評價，成為第一個分享體驗的人吧！
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button
                  onClick={() => router.push('/booking')}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-5 px-10 rounded-xl text-xl shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  🎮 立即體驗
                </button>
                <button
                  onClick={() => router.push('/join')}
                  className="bg-white text-purple-600 hover:bg-gray-50 font-bold py-5 px-10 rounded-xl text-xl shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  💼 成為夥伴
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Final CTA Section - 第四屏 */}
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-purple-600 to-indigo-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-4xl md:text-5xl font-bold text-white mb-8">
            準備開始您的遊戲之旅了嗎？
          </h3>
          <p className="text-xl md:text-2xl text-white/90 mb-12">
            立即加入 PeiPlay，體驗最專業的遊戲陪玩服務
          </p>
        </div>
      </div>

      {/* 滾動指示器 */}
      <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50">
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((index) => (
            <button
              key={index}
              onClick={() => scrollToSection(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                currentSection === index
                  ? 'bg-white scale-125'
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`滾動到第 ${index + 1} 區塊`}
            />
          ))}
        </div>
      </div>

    </div>
  )
}
