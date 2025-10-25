'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'

export default function Navigation() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [hasPartner, setHasPartner] = useState(false)
  const [isPartner, setIsPartner] = useState(false)
  const [partnerLoading, setPartnerLoading] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) => pathname === path

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 檢查夥伴狀態
  useEffect(() => {
    if (session?.user?.id && status === 'authenticated') {
      setPartnerLoading(true)
      
      const checkPartnerStatus = async (retryCount = 0) => {
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
            setPartnerLoading(false)
          } else if (res.status === 503 && retryCount < 2) {
            console.warn(`夥伴狀態檢查失敗 (${res.status})，${retryCount + 1}秒後重試...`)
            setTimeout(() => {
              checkPartnerStatus(retryCount + 1)
            }, (retryCount + 1) * 1000)
            return
          } else {
            console.warn('夥伴狀態檢查失敗:', res.status)
            setHasPartner(false)
            setIsPartner(false)
            setPartnerLoading(false)
          }
        } catch (error) {
          console.error('檢查夥伴狀態失敗:', error)
          if (retryCount < 2) {
            console.warn(`${retryCount + 1}秒後重試...`)
            setTimeout(() => {
              checkPartnerStatus(retryCount + 1)
            }, (retryCount + 1) * 1000)
            return
          }
          setHasPartner(false)
          setIsPartner(false)
          setPartnerLoading(false)
        }
      }
      
      checkPartnerStatus()
    } else {
      setHasPartner(false)
      setIsPartner(false)
      setPartnerLoading(false)
    }
  }, [session, status])

  // 處理點擊外部關閉用戶選單
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [userMenuRef])

  const navItems = [
    { path: '/booking', label: '預約陪玩', icon: '🎮' },
    { path: '/ranking', label: '排行榜', icon: '🏆' },
    { path: '/partners', label: '搜尋夥伴', icon: '🔍' },
    { path: '/join', label: '加入我們', icon: '💼' }
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? 'py-3' : 'py-4'
      }`}
      style={{
        background: isScrolled
          ? 'linear-gradient(180deg, rgba(15, 23, 41, 0.98) 0%, rgba(15, 23, 41, 0.95) 100%)'
          : 'linear-gradient(180deg, rgba(15, 23, 41, 0.8) 0%, rgba(15, 23, 41, 0.6) 100%)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${isScrolled ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.1)'}`,
        boxShadow: isScrolled ? '0 10px 40px rgba(0, 0, 0, 0.5)' : 'none'
      }}
    >
      <div className="w-full px-6">
        <div className="flex justify-between items-center">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 border-2"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.5)'
              }}
            >
              <span className="text-white text-2xl font-black">P</span>
            </div>
            <span className="font-black text-2xl text-white">
              PeiPlay
            </span>
          </Link>

          {/* 桌面導航 - 單行設計 */}
          <div className="hidden lg:flex items-center gap-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`relative px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 whitespace-nowrap ${
                  isActive(item.path)
                    ? 'text-white scale-105'
                    : 'text-white hover:scale-105'
                }`}
                style={{
                  background: isActive(item.path)
                    ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                    : 'transparent',
                  boxShadow: isActive(item.path)
                    ? '0 8px 24px rgba(59, 130, 246, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2) inset'
                    : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </span>
              </Link>
            ))}
          </div>

          {/* 用戶頭像 */}
          <div className="hidden md:flex items-center relative" ref={userMenuRef}>
            {session?.user ? (
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-7 h-7 rounded flex items-center justify-center transition-all duration-300 border-2"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.transform = 'scale(1.1)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                }}
              >
                <span className="text-white text-sm">👤</span>
              </button>
            ) : (
              <Link href="/auth/login" className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg text-white font-semibold transition-all">
                登入
              </Link>
            )}

            {/* 用戶下拉選單 */}
            {userMenuOpen && session?.user && (
              <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-xl py-4 border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-200 text-center">
                  <p className="text-sm text-gray-500">Signed in as</p>
                  <p className="font-semibold text-gray-900 text-lg">{session.user.name || session.user.email}</p>
                </div>
                
                {/* 時段管理 - 夥伴功能 */}
                {partnerLoading ? (
                  <div className="px-4 py-3">
                    <div className="flex items-center space-x-3 text-gray-500">
                      <span className="text-xl">🔄</span>
                      <span className="text-sm">載入中...</span>
                    </div>
                  </div>
                ) : isPartner && (
                  <div className="px-4 py-3">
                    <Link href="/partner/schedule" className="flex items-center space-x-3 text-gray-900 hover:text-blue-600 hover:bg-blue-50 transition-colors rounded-lg px-2 py-2">
                      <span className="text-xl">📅</span>
                      <span className="font-medium">時段管理</span>
                    </Link>
                  </div>
                )}
                
                {/* 預約管理 */}
                <div className="px-4 py-3">
                  <Link href="/bookings" className="flex items-center space-x-3 text-gray-900 hover:text-orange-600 hover:bg-orange-50 transition-colors rounded-lg px-2 py-2">
                    <span className="text-xl">📋</span>
                    <span className="font-medium">預約管理</span>
                  </Link>
                </div>
                
                {/* 個人資料 */}
                <div className="px-4 py-3">
                  <Link href="/profile" className="flex items-center space-x-3 text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-colors rounded-lg px-2 py-2">
                    <span className="text-xl">👤</span>
                    <span className="font-medium">個人資料</span>
                  </Link>
                </div>
                
                {/* 設定 */}
                <div className="px-4 py-3">
                  <Link href="/profile/settings" className="flex items-center space-x-3 text-gray-900 hover:text-gray-600 hover:bg-gray-50 transition-colors rounded-lg px-2 py-2">
                    <span className="text-xl">⚙️</span>
                    <span className="font-medium">設定</span>
                  </Link>
                </div>
                
                {/* 登出 */}
                <div className="border-t border-gray-200 mt-2 pt-2">
                  <button 
                    onClick={() => signOut()} 
                    className="w-full flex items-center space-x-3 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors rounded-lg px-4 py-3"
                  >
                    <span className="text-xl">🚪</span>
                    <span className="font-medium">登出</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 移動菜單按鈕 */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 border-2"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderColor: 'rgba(255, 255, 255, 0.2)'
            }}
          >
            <div className="flex flex-col gap-1.5">
              <div
                className={`w-5 h-0.5 bg-white transition-all duration-300 ${
                  isMenuOpen ? 'rotate-45 translate-y-2' : ''
                }`}
              ></div>
              <div
                className={`w-5 h-0.5 bg-white transition-all duration-300 ${
                  isMenuOpen ? 'opacity-0' : ''
                }`}
              ></div>
              <div
                className={`w-5 h-0.5 bg-white transition-all duration-300 ${
                  isMenuOpen ? '-rotate-45 -translate-y-2' : ''
                }`}
              ></div>
            </div>
          </button>
        </div>

        {/* 移動菜單 */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-500 ${
            isMenuOpen ? 'max-h-96 opacity-100 mt-6' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-2 pb-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                  isActive(item.path) ? 'text-white' : 'text-white'
                }`}
                style={{
                  background: isActive(item.path)
                    ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                    : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: isActive(item.path)
                    ? '0 8px 24px rgba(59, 130, 246, 0.5)'
                    : 'none'
                }}
              >
                <span className="text-2xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}