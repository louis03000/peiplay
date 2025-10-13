'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Navigation() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const isActive = (path: string) => pathname === path

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navItems = [
    { path: '/booking', label: '預約陪玩', icon: '🎮' },
    { path: '/ranking', label: '排行榜', icon: '🏆' },
    { path: '/partners', label: '搜尋夥伴', icon: '🔍' },
    { path: '/join', label: '加入我們', icon: '💼' }
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? 'py-4' : 'py-6'
      }`}
      style={{
        background: isScrolled
          ? 'linear-gradient(180deg, rgba(15, 23, 41, 0.95) 0%, rgba(15, 23, 41, 0.9) 100%)'
          : 'linear-gradient(180deg, rgba(15, 23, 41, 0.6) 0%, rgba(15, 23, 41, 0.3) 100%)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${isScrolled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)'}`,
        boxShadow: isScrolled ? '0 10px 40px rgba(0, 0, 0, 0.3)' : 'none'
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center">
          
          {/* Logo - 大而突出 */}
          <Link href="/" className="flex items-center gap-4 group">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 border-2"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)'
              }}
            >
              <span className="text-white text-2xl font-black">P</span>
            </div>
            <span
              className="font-black text-3xl transition-all duration-300 group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #60a5fa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              PeiPlay
            </span>
          </Link>

          {/* 桌面導航 - 大間距、突出設計 */}
          <div className="hidden lg:flex items-center gap-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`relative px-7 py-4 rounded-xl font-black text-lg transition-all duration-300 ${
                  isActive(item.path)
                    ? 'text-white scale-105'
                    : 'text-slate-300 hover:text-white hover:scale-105'
                }`}
                style={{
                  background: isActive(item.path)
                    ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                    : 'transparent',
                  boxShadow: isActive(item.path)
                    ? '0 8px 24px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
                    : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                <span className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="tracking-tight">{item.label}</span>
                </span>
                {/* 活躍指示器 */}
                {isActive(item.path) && (
                  <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/2 h-1 rounded-full"
                    style={{ background: 'rgba(255, 255, 255, 0.6)' }}
                  ></div>
                )}
              </Link>
            ))}
          </div>

          {/* 用戶頭像 */}
          <div className="hidden md:flex items-center">
            <button
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 border-2"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.transform = 'scale(1.1)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <span className="text-white text-xl">👤</span>
            </button>
          </div>

          {/* 移動菜單按鈕 */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 border-2"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)'
            }}
          >
            <div className="flex flex-col gap-2">
              <div
                className={`w-6 h-0.5 bg-white transition-all duration-300 ${
                  isMenuOpen ? 'rotate-45 translate-y-2.5' : ''
                }`}
              ></div>
              <div
                className={`w-6 h-0.5 bg-white transition-all duration-300 ${
                  isMenuOpen ? 'opacity-0' : ''
                }`}
              ></div>
              <div
                className={`w-6 h-0.5 bg-white transition-all duration-300 ${
                  isMenuOpen ? '-rotate-45 -translate-y-2.5' : ''
                }`}
              ></div>
            </div>
          </button>
        </div>

        {/* 移動菜單 */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-500 ${
            isMenuOpen ? 'max-h-96 opacity-100 mt-8' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-3 pb-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-4 px-8 py-5 rounded-2xl font-black text-xl transition-all duration-300 ${
                  isActive(item.path) ? 'text-white' : 'text-slate-300'
                }`}
                style={{
                  background: isActive(item.path)
                    ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                    : 'rgba(255, 255, 255, 0.05)',
                  boxShadow: isActive(item.path)
                    ? '0 8px 24px rgba(59, 130, 246, 0.4)'
                    : 'none'
                }}
              >
                <span className="text-3xl">{item.icon}</span>
                <span className="tracking-tight">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}