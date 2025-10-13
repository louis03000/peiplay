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
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'py-3' : 'py-5'
      }`}
      style={{
        background: isScrolled
          ? 'rgba(10, 14, 39, 0.95)'
          : 'rgba(10, 14, 39, 0.5)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${isScrolled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)'}`,
        boxShadow: isScrolled ? '0 10px 40px rgba(0, 0, 0, 0.3)' : 'none'
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 border border-white/10"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)'
              }}
            >
              <span className="text-white text-xl font-black">P</span>
            </div>
            <span
              className="font-black text-2xl transition-all duration-300 group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #FFFFFF 0%, #60A5FA 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              PeiPlay
            </span>
          </Link>

          {/* 桌面導航 */}
          <div className="hidden lg:flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`relative px-6 py-3 rounded-xl font-bold text-base transition-all duration-300 ${
                  isActive(item.path)
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
                style={{
                  background: isActive(item.path)
                    ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                    : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </span>
                {isActive(item.path) && (
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 rounded-full"
                    style={{ background: 'rgba(255, 255, 255, 0.5)' }}
                  ></div>
                )}
              </Link>
            ))}
          </div>

          {/* 用戶頭像 */}
          <div className="hidden md:flex items-center">
            <button
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border border-white/10"
              style={{ background: 'rgba(255, 255, 255, 0.05)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <span className="text-white text-lg">👤</span>
            </button>
          </div>

          {/* 移動菜單按鈕 */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border border-white/10"
            style={{ background: 'rgba(255, 255, 255, 0.05)' }}
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
          className={`lg:hidden overflow-hidden transition-all duration-300 ${
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
                  isActive(item.path) ? 'text-white' : 'text-gray-300'
                }`}
                style={{
                  background: isActive(item.path)
                    ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                    : 'rgba(255, 255, 255, 0.03)'
                }}
              >
                <span className="text-2xl">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}