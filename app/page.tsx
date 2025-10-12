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
    <div className="min-h-screen bg-white text-black">
      {/* 頂部橫幅 */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-800 text-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="text-2xl font-bold text-white">
                PeiPlay
              </Link>
            </div>
            
            {/* Navigation Links */}
            <div className="flex items-center space-x-8">
              <Link
                href="/booking"
                className="text-white hover:text-gray-200 transition-colors font-medium"
              >
                預約
              </Link>
              <Link
                href="/ranking"
                className="text-white hover:text-gray-200 transition-colors font-medium"
              >
                排行榜
              </Link>
              <Link
                href="/partners"
                className="text-white hover:text-gray-200 transition-colors font-medium"
              >
                搜尋
              </Link>
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center ml-2">
                <span className="text-white text-sm font-bold">I</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主要內容 - 白底黑字，文字置中 */}
      <div className="flex items-center justify-center min-h-[80vh] px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-8xl font-bold text-black mb-8">
            PeiPlay
          </h1>
          
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-8">
            高品質遊戲陪玩平台
          </h2>
          
          <p className="text-xl md:text-2xl text-black mb-12 max-w-3xl mx-auto">
            專業遊戲夥伴，安全預約系統，為您提供最優質的遊戲體驗。
            無論您是想找人陪玩，還是成為專業陪玩夥伴，PeiPlay 都是您的最佳選擇。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <button
              onClick={() => router.push('/booking')}
              className="bg-black text-white font-bold py-4 px-12 rounded-lg text-xl shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-3 w-full max-w-md"
            >
              🎮 立即預約陪玩
            </button>
            <button
              onClick={() => router.push('/join')}
              className="bg-white text-black border-2 border-black font-bold py-4 px-12 rounded-lg text-xl shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-3 w-full max-w-md"
            >
              💼 成為陪玩夥伴
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

