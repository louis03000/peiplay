'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navigation from '@/app/components/Navigation'

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
<<<<<<< HEAD
  const [reviews, setReviews] = useState<Review[]>([])
  const [isPartner, setIsPartner] = useState(false)
  const [hasPartner, setHasPartner] = useState(false)
=======
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
>>>>>>> 2723628dad138cdde67a84ff04e55b6cc76544e5

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      if (window.location.pathname === '/onboarding') return
      const checkUserProfile = async () => {
        try {
          const res = await fetch('/api/user/profile')
          if (res.ok) {
            const data = await res.json()
            const user = data.user
            const hasPhone = user.phone && user.phone.trim() !== ''
            const hasBirthday = user.birthday && user.birthday !== '2000-01-01'
            if (!hasPhone || !hasBirthday) router.push('/onboarding')
          }
        } catch (error) {
          console.error('檢查用戶資料失敗:', error)
        }
      }
<<<<<<< HEAD
      
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
      
=======
>>>>>>> 2723628dad138cdde67a84ff04e55b6cc76544e5
      checkUserProfile()
      checkPartnerStatus()
    } else {
      setHasPartner(false)
      setIsPartner(false)
    }
  }, [session, status, router])

  useEffect(() => {
    const fetchFeaturedPartners = async () => {
      try {
        const response = await fetch('/api/partners?featured=true&limit=6')
        if (response.ok) {
          const data = await response.json()
          setFeaturedPartners(data.slice(0, 6))
        }
      } catch (error) {
        setFeaturedPartners([
          { id: '1', name: '遊戲高手小陳', games: ['英雄聯盟', '特戰英豪'], halfHourlyRate: 150, rating: 4.9, totalBookings: 234 },
          { id: '2', name: '電競女神小雨', games: ['Apex 英雄', 'CS:GO'], halfHourlyRate: 200, rating: 4.8, totalBookings: 189 },
          { id: '3', name: '專業陪玩阿明', games: ['PUBG', '英雄聯盟'], halfHourlyRate: 120, rating: 4.7, totalBookings: 156 }
        ])
      }
    }
    fetchFeaturedPartners()
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden" 
         style={{
           background: `
             radial-gradient(circle at ${mouseX * 100}% ${mouseY * 100}%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
             radial-gradient(circle at ${100 - mouseX * 100}% ${100 - mouseY * 100}%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
             linear-gradient(135deg, #0a0e1a 0%, #0f1520 50%, #0a0e1a 100%)
           `
         }}>
      
      {/* 動態紋理層 */}
      <div className="fixed inset-0 opacity-[0.015]" 
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
             transform: `translate(${scrollY * 0.1}px, ${scrollY * 0.1}px)`
           }}></div>

      {/* 動態光暈 - 跟隨滑鼠 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute w-[800px] h-[800px] rounded-full blur-[120px] opacity-20 transition-all duration-1000"
             style={{
               background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
               left: `${mouseX * 100}%`,
               top: `${mouseY * 100}%`,
               transform: 'translate(-50%, -50%)'
             }}></div>
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[100px] opacity-15 transition-all duration-1500"
             style={{
               background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
               left: `${(1 - mouseX) * 100}%`,
               top: `${(1 - mouseY) * 100}%`,
               transform: 'translate(-50%, -50%)'
             }}></div>
      </div>

      {/* 漂浮裝飾元素 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-[10%] w-2 h-2 bg-blue-400 rounded-full opacity-40 animate-float-slow"></div>
        <div className="absolute top-40 right-[15%] w-3 h-3 bg-purple-400 rounded-full opacity-30 animate-float-medium"></div>
        <div className="absolute bottom-32 left-[20%] w-2 h-2 bg-cyan-400 rounded-full opacity-40 animate-float-fast"></div>
        <div className="absolute top-[60%] right-[25%] w-4 h-4 border-2 border-blue-400 rounded-full opacity-20 animate-spin-very-slow"></div>
        <div className="absolute bottom-[20%] right-[10%] w-3 h-3 border-2 border-purple-400 opacity-25 rotate-45 animate-pulse-gentle"></div>
      </div>

      <Navigation />

      {/* Hero Section - 震撼視覺 */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-6">
        <div className="relative z-10 w-full max-w-7xl mx-auto text-center">
          
          {/* 主內容 */}
          <div className="space-y-12 animate-fade-in-up">
            
            {/* 頂部標籤 */}
            <div className="inline-flex items-center gap-3 px-8 py-4 rounded-full backdrop-blur-xl border border-white/10 animate-scale-in"
                 style={{
                   background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                   boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                 }}>
              <span className="text-3xl">🎮</span>
              <span className="text-blue-300 font-bold text-xl tracking-wide">專業遊戲陪玩平台</span>
            </div>

            {/* 超大標題 - 漸層發光效果 */}
            <div className="relative">
              <h1 className="text-8xl sm:text-9xl lg:text-[12rem] font-black leading-none mb-8 tracking-tight animate-fade-in"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #60a5fa 40%, #3b82f6 60%, #2563eb 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundSize: '200% 200%',
                    animation: 'gradient-shift 8s ease infinite, fade-in 1s ease-out',
                    filter: 'drop-shadow(0 0 40px rgba(59, 130, 246, 0.5))',
                    textShadow: '0 0 80px rgba(59, 130, 246, 0.3)'
                  }}>
                PeiPlay
              </h1>
              
              {/* 標題下方裝飾線 */}
              <div className="flex items-center justify-center gap-4 mb-12">
                <div className="h-px w-24 bg-gradient-to-r from-transparent via-blue-400 to-transparent"></div>
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse-gentle"></div>
                <div className="h-px w-24 bg-gradient-to-r from-transparent via-blue-400 to-transparent"></div>
              </div>
            </div>

            {/* 副標題 - 大而清晰 */}
            <div className="space-y-6 max-w-5xl mx-auto animate-fade-in-up text-center" style={{animationDelay: '0.2s'}}>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight"
                  style={{
                    color: '#ffffff',
                    textShadow: '0 2px 20px rgba(255, 255, 255, 0.3)'
                  }}>
                連接全球優質遊戲夥伴
              </h2>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-medium leading-relaxed"
                 style={{
                   color: '#93c5fd',
                   textShadow: '0 2px 15px rgba(147, 197, 253, 0.4)'
                 }}>
                打造最專業的陪玩體驗平台
              </p>
              <p className="text-xl sm:text-2xl leading-relaxed max-w-3xl mx-auto font-medium" 
                 style={{
                   letterSpacing: '0.025em',
                   lineHeight: '1.8',
                   color: '#e2e8f0',
                   textShadow: '0 2px 10px rgba(226, 232, 240, 0.3)'
                 }}>
                無論您是尋找專業陪玩服務，還是想成為認證陪玩夥伴<br/>
                PeiPlay 為您提供安全、便捷、高品質的遊戲社交體驗
              </p>
            </div>

            {/* CTA 按鈕組 - 大而醒目 */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8 animate-fade-in-up" 
                 style={{animationDelay: '0.4s'}}>
              <button
                onClick={() => router.push('/booking')}
                className="group relative px-16 py-7 rounded-2xl font-black text-2xl overflow-hidden transition-all duration-500 hover:scale-105 hover:shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  boxShadow: '0 20px 60px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
                }}>
                <span className="relative z-10 flex items-center gap-4 text-white">
                  <span className="text-3xl">🎯</span>
                  立即預約陪玩
                  <svg className="w-7 h-7 transition-transform group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </button>
<<<<<<< HEAD
              {!isPartner && (
                <button
                  onClick={() => router.push('/join')}
                  className="bg-white text-blue-600 hover:bg-blue-50 border-2 border-blue-600 font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  💼 成為陪玩夥伴
                </button>
              )}
              {isPartner && (
                <button
                  onClick={() => router.push('/partner/schedule')}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  🎯 夥伴管理
                </button>
              )}
=======

              <button
                onClick={() => router.push('/join')}
                className="group relative px-16 py-7 rounded-2xl font-black text-2xl backdrop-blur-xl border-3 transition-all duration-500 hover:scale-105"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(59, 130, 246, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3)'
                }}>
                <span className="flex items-center gap-4 text-white">
                  <span className="text-3xl">💼</span>
                  成為陪玩夥伴
                  <svg className="w-7 h-7 transition-transform group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
>>>>>>> 2723628dad138cdde67a84ff04e55b6cc76544e5
            </div>

            {/* 搜尋欄 - 精緻設計 */}
            <div className="max-w-3xl mx-auto pt-12 animate-fade-in-up" style={{animationDelay: '0.6s'}}>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition duration-500 animate-pulse-gentle"></div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜尋遊戲或夥伴名稱..."
                    className="w-full px-10 py-7 rounded-2xl text-xl font-semibold focus:outline-none transition-all duration-300"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(20px)',
                      color: 'white',
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3) inset'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                      e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1), 0 10px 40px rgba(0, 0, 0, 0.3) inset'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3) inset'
                    }}
                  />
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 text-4xl opacity-50 transition-transform group-hover:scale-110">
                    🔍
                  </div>
                </div>
<<<<<<< HEAD
              ))}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-8">💬</div>
              <p className="text-gray-600 text-xl mb-8">
                目前還沒有用戶評價，成為第一個分享體驗的人吧！
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => router.push('/booking')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  🎮 立即體驗
                </button>
                {!isPartner && (
                  <button
                    onClick={() => router.push('/join')}
                    className="bg-white text-blue-600 hover:bg-blue-50 border-2 border-blue-600 font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    💼 成為夥伴
                  </button>
                )}
                {isPartner && (
                  <button
                    onClick={() => router.push('/partner/schedule')}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    🎯 夥伴管理
                  </button>
                )}
=======
>>>>>>> 2723628dad138cdde67a84ff04e55b6cc76544e5
              </div>
            </div>

            {/* 滾動提示 */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce-slow">
              <div className="flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
                <span className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Scroll</span>
                <div className="w-8 h-14 border-3 border-white/30 rounded-full flex justify-center pt-3">
                  <div className="w-2 h-4 bg-white/60 rounded-full animate-scroll-indicator"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 視差裝飾元素 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[20%] left-[5%] w-64 h-64 border border-blue-400/10 rounded-full"
               style={{transform: `translateY(${scrollY * 0.3}px) scale(${1 + scrollY * 0.0005})`}}></div>
          <div className="absolute bottom-[10%] right-[8%] w-96 h-96 border border-purple-400/10 rounded-full"
               style={{transform: `translateY(${scrollY * -0.2}px) scale(${1 + scrollY * 0.0003})`}}></div>
        </div>
      </section>

      {/* 功能特色區 - 視差效果 */}
      <section className="relative py-40 px-6" style={{transform: `translateY(${scrollY * 0.1}px)`}}>
        <div className="max-w-7xl mx-auto text-center">
          
          {/* 區塊標題 */}
          <div className="mb-24 space-y-8">
            <h2 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight"
                style={{
                  color: '#ffffff',
                  textShadow: '0 2px 20px rgba(255, 255, 255, 0.3)'
                }}>
              為什麼選擇 PeiPlay？
            </h2>
            <div className="flex items-center justify-center gap-4">
              <div className="h-1 w-32 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full"></div>
              <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse-gentle"></div>
              <div className="h-1 w-32 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full"></div>
            </div>
            <p className="text-2xl sm:text-3xl font-medium max-w-3xl mx-auto leading-relaxed"
               style={{
                 color: '#e2e8f0',
                 textShadow: '0 2px 10px rgba(226, 232, 240, 0.3)'
               }}>
              我們提供最專業、安全、高品質的遊戲陪玩服務
            </p>
          </div>

          {/* 功能卡片網格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { 
                icon: '🔒', 
                title: '安全保證', 
                desc: '嚴格的夥伴認證流程，確保每位夥伴都經過專業審核，為您提供安全可靠的服務體驗',
                color: 'from-blue-600 to-blue-700',
                delay: '0s'
              },
              { 
                icon: '⭐', 
                title: '優質服務', 
                desc: '專業的遊戲夥伴，豐富的遊戲經驗，為您提供高品質的陪玩服務和專業遊戲指導',
                color: 'from-purple-600 to-purple-700',
                delay: '0.1s'
              },
              { 
                icon: '🎯', 
                title: '客製體驗', 
                desc: '根據您的需求智能匹配最適合的夥伴，提供個人化的遊戲體驗和專業建議',
                color: 'from-cyan-600 to-cyan-700',
                delay: '0.2s'
              },
              { 
                icon: '⚡', 
                title: '即時匹配', 
                desc: '智能匹配系統，快速找到最適合的遊戲夥伴，享受流暢便捷的預約體驗',
                color: 'from-emerald-600 to-emerald-700',
                delay: '0.3s'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative rounded-3xl p-10 backdrop-blur-xl border transition-all duration-500 hover:-translate-y-4 animate-fade-in-up"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                  animationDelay: feature.delay
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.boxShadow = '0 30px 80px rgba(59, 130, 246, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.3)'
                }}
              >
                {/* 卡片頂部漸層 */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.color} rounded-t-3xl`}></div>
                
                {/* 圖標 */}
                <div className="w-24 h-24 mx-auto mb-8 rounded-2xl flex items-center justify-center text-6xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6"
                     style={{
                       background: `linear-gradient(135deg, ${feature.color.replace('from-', 'rgba(59, 130, 246, 0.1)')} 0%, rgba(139, 92, 246, 0.1) 100%)`,
                       border: '2px solid rgba(255, 255, 255, 0.1)',
                       boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
                     }}>
                  {feature.icon}
                </div>

                {/* 標題 */}
                <h3 className="text-3xl font-black mb-6 text-center tracking-tight"
                    style={{
                      color: '#ffffff',
                      textShadow: '0 2px 15px rgba(255, 255, 255, 0.3)'
                    }}>
                  {feature.title}
                </h3>

                {/* 描述 */}
                <p className="text-lg text-center leading-relaxed font-medium"
                   style={{
                     letterSpacing: '0.015em',
                     lineHeight: '1.8',
                     color: '#e2e8f0',
                     textShadow: '0 2px 10px rgba(226, 232, 240, 0.3)'
                   }}>
                  {feature.desc}
                </p>

                {/* 懸停光效 */}
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                     style={{
                       background: `radial-gradient(circle at 50% 0%, ${feature.color.includes('blue') ? 'rgba(59, 130, 246, 0.1)' : feature.color.includes('purple') ? 'rgba(139, 92, 246, 0.1)' : feature.color.includes('cyan') ? 'rgba(6, 182, 212, 0.1)' : 'rgba(16, 185, 129, 0.1)'} 0%, transparent 70%)`
                     }}></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 精選夥伴區 */}
      <section className="relative py-40 px-6">
        <div className="max-w-7xl mx-auto text-center">
          
          {/* 區塊標題 */}
          <div className="mb-24 space-y-8">
            <h2 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight"
                style={{
                  color: '#ffffff',
                  textShadow: '0 2px 20px rgba(255, 255, 255, 0.3)'
                }}>
              精選遊戲夥伴
            </h2>
            <div className="flex items-center justify-center gap-4">
              <div className="h-1 w-32 bg-gradient-to-r from-transparent via-purple-400 to-transparent rounded-full"></div>
              <div className="w-3 h-3 rounded-full bg-purple-400 animate-pulse-gentle"></div>
              <div className="h-1 w-32 bg-gradient-to-r from-transparent via-purple-400 to-transparent rounded-full"></div>
            </div>
            <p className="text-2xl sm:text-3xl font-medium max-w-3xl mx-auto leading-relaxed"
               style={{
                 color: '#e2e8f0',
                 textShadow: '0 2px 10px rgba(226, 232, 240, 0.3)'
               }}>
              專業認證的遊戲夥伴，為您提供最優質的陪玩服務
            </p>
          </div>

          {/* 夥伴卡片網格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {featuredPartners.map((partner, index) => (
              <div
                key={partner.id}
                className="group relative rounded-3xl overflow-hidden backdrop-blur-xl border transition-all duration-500 hover:-translate-y-4 animate-fade-in-up"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                  animationDelay: `${index * 0.1}s`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 30px 80px rgba(139, 92, 246, 0.3)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.3)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                }}
              >
                {/* 卡片頭部 */}
                <div className="h-56 relative overflow-hidden"
                     style={{background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'}}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-7xl transition-transform duration-500 group-hover:scale-110">
                      🎮
                    </div>
                  </div>
                  {/* 排名徽章 */}
                  {index < 3 && (
                    <div className="absolute top-6 left-6 w-16 h-16 rounded-xl flex items-center justify-center font-black text-2xl"
                         style={{
                           background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                           color: 'white',
                           boxShadow: '0 8px 24px rgba(245, 158, 11, 0.5)'
                         }}>
                      #{index + 1}
                    </div>
                  )}
                  {/* 漸層覆蓋 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>

                {/* 卡片內容 */}
                <div className="p-8 space-y-6">
                  {/* 夥伴名稱 */}
                  <h3 className="text-3xl font-black tracking-tight text-center"
                      style={{
                        color: '#ffffff',
                        textShadow: '0 2px 15px rgba(255, 255, 255, 0.3)'
                      }}>
                    {partner.name}
                  </h3>

                  {/* 遊戲標籤 */}
                  <div className="flex flex-wrap gap-3">
                    {partner.games.slice(0, 2).map((game, i) => (
                      <span key={i} className="px-5 py-2 rounded-xl text-base font-bold backdrop-blur-md border"
                            style={{
                              background: 'rgba(139, 92, 246, 0.1)',
                              borderColor: 'rgba(139, 92, 246, 0.3)',
                              color: '#c4b5fd'
                            }}>
                        {game}
                      </span>
                    ))}
                  </div>

                  {/* 評分和價格 */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">⭐</span>
                      <div>
                        <div className="text-2xl font-black text-white">{partner.rating}</div>
                        <div className="text-sm text-slate-400 font-medium">({partner.totalBookings} 次)</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        ${partner.halfHourlyRate}
                      </div>
                      <div className="text-sm text-slate-400 font-medium">每半小時</div>
                    </div>
                  </div>

                  {/* 預約按鈕 */}
                  <button
                    onClick={() => router.push(`/booking?partnerId=${partner.id}`)}
                    className="w-full py-5 rounded-xl font-black text-xl transition-all duration-300 hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                      color: 'white',
                      boxShadow: '0 10px 30px rgba(139, 92, 246, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 15px 40px rgba(139, 92, 246, 0.5)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(139, 92, 246, 0.3)'
                    }}
                  >
                    立即預約
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 查看更多按鈕 */}
          <div className="text-center mt-16">
            <button
              onClick={() => router.push('/partners')}
              className="px-14 py-6 rounded-2xl font-black text-2xl backdrop-blur-xl border-3 transition-all duration-500 hover:scale-105"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              }}
            >
<<<<<<< HEAD
              🎮 立即預約
            </button>
            {!isPartner && (
              <button
                onClick={() => router.push('/join')}
                className="bg-white text-blue-600 hover:bg-blue-50 border-2 border-blue-600 font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                💼 成為夥伴
              </button>
            )}
            {isPartner && (
              <button
                onClick={() => router.push('/partner/schedule')}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                🎯 夥伴管理
              </button>
            )}
=======
              查看更多夥伴
            </button>
>>>>>>> 2723628dad138cdde67a84ff04e55b6cc76544e5
          </div>
        </div>
      </section>

      {/* 統計數據區 */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { value: '500+', label: '活躍夥伴', icon: '👥', color: '#3b82f6' },
              { value: '10,000+', label: '成功預約', icon: '📅', color: '#8b5cf6' },
              { value: '4.9', label: '用戶評價', icon: '⭐', color: '#06b6d4' },
              { value: '24/7', label: '客服支援', icon: '🛠️', color: '#10b981' }
            ].map((stat, index) => (
              <div key={index} className="space-y-4 group">
                <div className="text-5xl mb-4 transition-transform duration-500 group-hover:scale-110">
                  {stat.icon}
                </div>
                <div className="text-6xl sm:text-7xl font-black transition-all duration-500 group-hover:scale-110"
                     style={{
                       background: `linear-gradient(135deg, ${stat.color} 0%, ${stat.color}dd 100%)`,
                       WebkitBackgroundClip: 'text',
                       WebkitTextFillColor: 'transparent',
                       filter: 'drop-shadow(0 2px 10px rgba(255, 255, 255, 0.3))'
                     }}>
                  {stat.value}
                </div>
                <div className="text-xl font-bold"
                     style={{
                       color: '#e2e8f0',
                       textShadow: '0 2px 10px rgba(226, 232, 240, 0.3)'
                     }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 最終 CTA 區 */}
      <section className="relative py-40 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          <h2 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-tight"
              style={{
                color: '#ffffff',
                textShadow: '0 2px 20px rgba(255, 255, 255, 0.3)'
              }}>
            準備開始您的<br/>遊戲之旅？
          </h2>
          <p className="text-2xl sm:text-3xl font-medium leading-relaxed"
             style={{
               color: '#e2e8f0',
               textShadow: '0 2px 10px rgba(226, 232, 240, 0.3)'
             }}>
            立即預約專業陪玩夥伴，享受優質的遊戲體驗
          </p>
          
          <button
            onClick={() => router.push('/booking')}
            className="group relative px-20 py-8 rounded-2xl font-black text-3xl overflow-hidden transition-all duration-500 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              boxShadow: '0 20px 60px rgba(59, 130, 246, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 30px 80px rgba(59, 130, 246, 0.6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(59, 130, 246, 0.4)'
            }}
          >
            <span className="relative z-10 flex items-center gap-4 text-white">
              開始預約
              <svg className="w-8 h-8 transition-transform group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </button>
        </div>
      </section>

      {/* 自定義動畫 */}
      <style jsx>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-30px); }
        }
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-25px); }
        }
        .animate-float-medium {
          animation: float-medium 6s ease-in-out infinite;
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float-fast {
          animation: float-fast 4s ease-in-out infinite;
        }
        @keyframes spin-very-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-very-slow {
          animation: spin-very-slow 30s linear infinite;
        }
        @keyframes pulse-gentle {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        .animate-pulse-gentle {
          animation: pulse-gentle 3s ease-in-out infinite;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        @keyframes scroll-indicator {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(12px); opacity: 0; }
        }
        .animate-scroll-indicator {
          animation: scroll-indicator 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}