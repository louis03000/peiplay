'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  images?: string[]
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
  const [scrollY, setScrollY] = useState(0)

  // 滾動效果
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      if (window.location.pathname === '/onboarding') {
        return
      }
      
      const checkUserProfile = async () => {
        try {
          const res = await fetch('/api/user/profile')
          if (res.ok) {
            const data = await res.json()
            const user = data.user
            const hasPhone = user.phone && user.phone.trim() !== ''
            const hasBirthday = user.birthday && user.birthday !== '2000-01-01'
            
            if (!hasPhone || !hasBirthday) {
              router.push('/onboarding')
            }
          }
        } catch (error) {
          console.error('檢查用戶資料失敗:', error)
        }
      }
      
      checkUserProfile()
    }
  }, [session, status, router])

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

  useEffect(() => {
    setGameRankings([
      { name: '英雄聯盟', playerCount: 2847, icon: '⚔️' },
      { name: '特戰英豪', playerCount: 1923, icon: '🎯' },
      { name: 'Apex 英雄', playerCount: 1654, icon: '🚀' },
      { name: 'CS:GO', playerCount: 1432, icon: '🔫' },
      { name: 'PUBG', playerCount: 987, icon: '🏃' }
    ])
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden" style={{background: 'linear-gradient(180deg, #0A0E27 0%, #1A1F3A 50%, #0F1729 100%)'}}>
      <Navigation />

      {/* 超現代化 Hero Section - 深色主題 */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 動態網格背景 */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(26, 115, 232, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(26, 115, 232, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          transform: `translateY(${scrollY * 0.5}px)`
        }}></div>

        {/* 漸層光暈效果 */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
             style={{background: 'radial-gradient(circle, #1A73E8 0%, transparent 70%)'}}></div>
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full opacity-15 blur-3xl"
             style={{background: 'radial-gradient(circle, #5C7AD6 0%, transparent 70%)'}}></div>
        <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
             style={{background: 'radial-gradient(circle, #00BFA5 0%, transparent 70%)', transform: 'translate(-50%, -50%)'}}></div>

        {/* 浮動幾何裝飾 */}
        <div className="absolute top-20 left-10 w-20 h-20 border-2 border-blue-500 opacity-20 rounded-lg animate-spin-slow"></div>
        <div className="absolute bottom-40 right-20 w-32 h-32 border-2 border-cyan-400 opacity-15 rounded-full animate-pulse-slow"></div>
        <div className="absolute top-1/3 right-1/4 w-16 h-16 border-2 border-purple-500 opacity-25 rotate-45 animate-float"></div>

        <div className="relative z-10 px-8 py-32 text-center max-w-7xl mx-auto">
          {/* 超大現代化標題 */}
          <div className="mb-16 space-y-8">
            <div className="inline-block px-6 py-3 rounded-full mb-8 backdrop-blur-md border border-white/10"
                 style={{background: 'rgba(26, 115, 232, 0.1)'}}>
              <span className="text-blue-400 text-lg font-bold tracking-wider">🎮 專業遊戲陪玩平台</span>
            </div>
            
            <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black leading-tight mb-8"
                style={{
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #60A5FA 50%, #3B82F6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 80px rgba(59, 130, 246, 0.5)',
                  letterSpacing: '-0.02em'
                }}>
              PeiPlay
            </h1>

            <div className="h-1 w-32 mx-auto rounded-full mb-12"
                 style={{background: 'linear-gradient(90deg, transparent, #3B82F6, transparent)'}}></div>

            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-300 max-w-4xl mx-auto leading-relaxed mb-8">
              連接全球優質遊戲夥伴<br/>
              <span className="text-blue-400">提供最專業的陪玩體驗</span>
            </p>

            <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed font-medium">
              無論您是尋找陪玩服務，還是想成為專業陪玩夥伴，<br/>
              PeiPlay 都是您的最佳選擇
            </p>
          </div>

          {/* 現代化 CTA 按鈕組 */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-20">
            <button
              onClick={() => router.push('/booking')}
              className="group relative px-12 py-5 rounded-2xl font-bold text-xl transition-all duration-300 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(255,255,255,0.1) inset'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 20px 60px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 40px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(255,255,255,0.1) inset'
              }}
            >
              <span className="relative z-10 text-white flex items-center gap-3">
                立即預約陪玩
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>

            <button
              onClick={() => router.push('/join')}
              className="group relative px-12 py-5 rounded-2xl font-bold text-xl transition-all duration-300 backdrop-blur-md border-2 border-white/20"
              style={{background: 'rgba(255, 255, 255, 0.05)'}}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              }}
            >
              <span className="text-white flex items-center gap-3">
                成為陪玩夥伴
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>

          {/* 現代化搜尋欄 */}
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜尋遊戲或夥伴..."
                  className="w-full px-6 py-4 rounded-2xl text-lg font-medium focus:outline-none transition-all duration-300 border border-white/10"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    color: 'white'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  }}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="text-2xl opacity-50">🔍</span>
                </div>
              </div>
            </div>
          </div>

          {/* 滾動提示 */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center p-2">
              <div className="w-1 h-3 bg-white/50 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </section>

      {/* 功能特色區 - 深色卡片設計 */}
      <section className="relative py-32 px-8">
        {/* 區塊背景 */}
        <div className="absolute inset-0" style={{background: 'rgba(15, 23, 41, 0.5)'}}></div>
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl sm:text-6xl font-black mb-6 text-white">為什麼選擇 PeiPlay？</h2>
            <div className="h-1 w-24 mx-auto rounded-full mb-8"
                 style={{background: 'linear-gradient(90deg, transparent, #3B82F6, transparent)'}}></div>
            <p className="text-xl text-gray-400 font-medium">專業、安全、高品質的遊戲陪玩服務</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: '🔒', title: '安全保證', desc: '嚴格的夥伴認證流程，確保服務品質', color: '#3B82F6' },
              { icon: '⭐', title: '優質服務', desc: '專業的遊戲夥伴，豐富的遊戲經驗', color: '#8B5CF6' },
              { icon: '🎯', title: '客製體驗', desc: '個人化匹配，提供最適合的服務', color: '#06B6D4' },
              { icon: '⚡', title: '即時匹配', desc: '智能匹配系統，快速找到夥伴', color: '#10B981' }
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-2xl backdrop-blur-md border border-white/10 transition-all duration-300 hover:-translate-y-2"
                style={{background: 'rgba(255, 255, 255, 0.03)'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.boxShadow = `0 20px 60px ${feature.color}20`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-xl flex items-center justify-center text-4xl transition-transform duration-300 group-hover:scale-110"
                     style={{background: `${feature.color}20`, border: `1px solid ${feature.color}40`}}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white text-center">{feature.title}</h3>
                <p className="text-gray-400 text-center leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 精選夥伴區 */}
      <section className="relative py-32 px-8">
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl sm:text-6xl font-black mb-6 text-white">精選夥伴</h2>
            <div className="h-1 w-24 mx-auto rounded-full mb-8"
                 style={{background: 'linear-gradient(90deg, transparent, #3B82F6, transparent)'}}></div>
            <p className="text-xl text-gray-400 font-medium">專業認證的遊戲夥伴，為您提供最優質的服務</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredPartners.map((partner, index) => (
              <div
                key={partner.id}
                className="group relative rounded-2xl overflow-hidden backdrop-blur-md border border-white/10 transition-all duration-300 hover:-translate-y-2"
                style={{background: 'rgba(255, 255, 255, 0.03)'}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(59, 130, 246, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* 卡片頭部 */}
                <div className="h-48 relative overflow-hidden"
                     style={{background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'}}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-5xl">
                      🎮
                    </div>
                  </div>
                  {index < 3 && (
                    <div className="absolute top-4 left-4 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                         style={{background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'}}>
                      {index + 1}
                    </div>
                  )}
                </div>

                {/* 卡片內容 */}
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-white mb-4">{partner.name}</h3>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    {partner.games.slice(0, 2).map((game, i) => (
                      <span key={i} className="px-3 py-1 rounded-lg text-sm font-medium backdrop-blur-md border border-white/10"
                            style={{background: 'rgba(59, 130, 246, 0.1)', color: '#93C5FD'}}>
                        {game}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 text-xl">⭐</span>
                      <span className="text-white font-bold text-lg">{partner.rating}</span>
                      <span className="text-gray-400 text-sm">({partner.totalBookings})</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-400">${partner.halfHourlyRate}</div>
                      <div className="text-xs text-gray-400">每半小時</div>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/booking?partnerId=${partner.id}`)}
                    className="w-full py-3 rounded-xl font-bold transition-all duration-300 border border-white/10"
                    style={{background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', color: 'white'}}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(59, 130, 246, 0.3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    立即預約
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <button
              onClick={() => router.push('/partners')}
              className="px-10 py-4 rounded-xl font-bold text-lg transition-all duration-300 backdrop-blur-md border-2 border-white/20"
              style={{background: 'rgba(255, 255, 255, 0.05)', color: 'white'}}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              }}
            >
              查看更多夥伴
            </button>
          </div>
        </div>
      </section>

      {/* 統計數據區 */}
      <section className="relative py-32 px-8">
        <div className="absolute inset-0" style={{background: 'rgba(15, 23, 41, 0.5)'}}></div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            {[
              { value: '500+', label: '活躍夥伴', color: '#3B82F6' },
              { value: '10,000+', label: '成功預約', color: '#8B5CF6' },
              { value: '4.9', label: '用戶評價', color: '#06B6D4' },
              { value: '24/7', label: '客服支援', color: '#10B981' }
            ].map((stat, index) => (
              <div key={index} className="group">
                <div className="text-5xl sm:text-6xl font-black mb-4 transition-transform duration-300 group-hover:scale-110"
                     style={{color: stat.color}}>
                  {stat.value}
                </div>
                <div className="text-lg text-gray-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 最終 CTA 區 */}
      <section className="relative py-32 px-8">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-5xl sm:text-6xl font-black mb-8 text-white">準備開始您的遊戲之旅？</h2>
          <p className="text-xl text-gray-400 mb-12 font-medium">立即預約專業陪玩夥伴，享受優質的遊戲體驗</p>
          
          <button
            onClick={() => router.push('/booking')}
            className="relative px-16 py-6 rounded-2xl font-bold text-2xl transition-all duration-300 overflow-hidden group"
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)'
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(59, 130, 246, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(59, 130, 246, 0.3)'
            }}
          >
            <span className="relative z-10 text-white flex items-center justify-center gap-3">
              開始預約
              <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </button>
        </div>
      </section>

      {/* 自定義動畫 */}
      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.3; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(45deg); }
          50% { transform: translateY(-20px) rotate(45deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}