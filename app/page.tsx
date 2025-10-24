'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import PartnerCard from '@/components/PartnerCard'
import PartnerFilter from '@/components/PartnerFilter'
import PartnerHero from '@/components/PartnerHero'
import { FaBolt, FaCrown, FaMedal, FaTrophy, FaComments, FaHeart, FaStar, FaQuoteLeft, FaQuoteRight } from 'react-icons/fa'

interface Review {
  id: string
  rating: number
  comment: string
  customerName: string
  createdAt: string
}

interface FeaturedPartner {
  id: string
  name: string
  games: string[]
  halfHourlyRate: number
  rating: number
  totalBookings: number
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [isPartner, setIsPartner] = useState(false)
  const [hasPartner, setHasPartner] = useState(false)
  const [featuredPartners, setFeaturedPartners] = useState<FeaturedPartner[]>([])
  const [scrollY, setScrollY] = useState(0)
  const [mouseX, setMouseX] = useState(0)
  const [mouseY, setMouseY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX / window.innerWidth)
      setMouseY(e.clientY / window.innerHeight)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      if (window.location.pathname === '/onboarding') return
      const checkUserProfile = async () => {
        try {
          const res = await fetch('/api/user/profile')
          if (res.ok) {
            const data = await res.json()
            const hasPhone = data.user?.phone && data.user.phone.trim() !== ''
            const hasBirthday = data.user?.birthday
            if (!hasPhone || !hasBirthday) router.push('/onboarding')
          }
        } catch (error) {
          console.error('檢查用戶資料失敗:', error)
        }
      }
      
      // 檢查夥伴狀態
      const checkPartnerStatus = async () => {
        try {
          const res = await fetch('/api/partners/self')
          if (res.ok) {
            const data = await res.json()
            if (data && data.partner) {
              setHasPartner(data.partner.status === 'APPROVED')
              setIsPartner(true)
            } else {
              setHasPartner(false)
              setIsPartner(false)
            }
          } else {
            setHasPartner(false)
            setIsPartner(false)
          }
        } catch (error) {
          console.error('檢查夥伴狀態失敗:', error)
          setHasPartner(false)
          setIsPartner(false)
        }
      }
      
      checkUserProfile()
      checkPartnerStatus()
    } else {
      setHasPartner(false)
      setIsPartner(false)
    }
  }, [session, status, router])

  const handleQuickBook = (partnerId: string) => {
    router.push(`/booking?partner=${partnerId}&instant=true`)
  }

  return (
    <div className="min-h-screen relative overflow-hidden" 
         style={{
           background: `
             radial-gradient(circle at ${mouseX * 100}% ${mouseY * 100}%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
             linear-gradient(135deg, #667eea 0%, #764ba2 100%)
           `
         }}>
      {/* Hero Section */}
      <div className="relative py-20 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            找到你的
            <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              遊戲夥伴
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
            專業的遊戲陪練服務，讓你在遊戲中更上一層樓
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/booking')}
              className="bg-white text-blue-600 px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              立即預約
            </button>
            <button
              onClick={() => router.push('/partners')}
              className="border-2 border-white text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-white hover:text-blue-600 transition-all duration-300"
            >
              查看夥伴
            </button>
          </div>
        </div>
      </div>

      {/* 特色功能 */}
      <div className="py-20 px-6 bg-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-16">為什麼選擇我們？</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-white/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <FaBolt className="text-3xl text-yellow-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">即時預約</h3>
              <p className="text-white/80">找到現在有空的夥伴，立即開始遊戲</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <FaCrown className="text-3xl text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">專業夥伴</h3>
              <p className="text-white/80">經過認證的高段位玩家，提供專業指導</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <FaHeart className="text-3xl text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">優質服務</h3>
              <p className="text-white/80">24/7 客服支援，確保最佳遊戲體驗</p>
            </div>
          </div>
        </div>
      </div>

      {/* 推薦夥伴 */}
      <div className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-16">推薦夥伴</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* 這裡會顯示推薦的夥伴卡片 */}
            <div className="text-center py-12">
              <p className="text-gray-500">載入中...</p>
            </div>
          </div>
        </div>
      </div>

      {/* 用戶評價 */}
      <div className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-16">用戶評價</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar key={star} className="text-sm" />
                  ))}
                </div>
                <span className="ml-2 text-gray-600 text-sm">5.0</span>
              </div>
              <p className="text-gray-700 mb-4">
                "夥伴很專業，幫助我從青銅升到黃金！"
              </p>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  王
                </div>
                <span className="ml-3 text-gray-600">王小明</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar key={star} className="text-sm" />
                  ))}
                </div>
                <span className="ml-2 text-gray-600 text-sm">5.0</span>
              </div>
              <p className="text-gray-700 mb-4">
                "服務很好，時間安排很彈性！"
              </p>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                  李
                </div>
                <span className="ml-3 text-gray-600">李小華</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar key={star} className="text-sm" />
                  ))}
                </div>
                <span className="ml-2 text-gray-600 text-sm">5.0</span>
              </div>
              <p className="text-gray-700 mb-4">
                "價格合理，效果很好，推薦！"
              </p>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  張
                </div>
                <span className="ml-3 text-gray-600">張小美</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">準備開始你的遊戲之旅？</h2>
          <p className="text-xl text-white/90 mb-8">
            立即找到適合的夥伴，開始提升你的遊戲技能
          </p>
          <button
            onClick={() => router.push('/booking')}
            className="bg-white text-blue-600 px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            開始預約
          </button>
        </div>
      </div>
    </div>
  )
}