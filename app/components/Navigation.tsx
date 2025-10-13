'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Navigation() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const isActive = (path: string) => {
    return pathname === path
  }

  // 監聽滾動事件
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      isScrolled ? 'py-3' : 'py-6'
    }`} style={{
      background: isScrolled 
        ? 'rgba(26, 115, 232, 0.98)' 
        : 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15)'
    }}>
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex justify-between items-center">
          {/* 強化 Logo */}
          <Link href="/" className="flex items-center gap-4 group">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12 shadow-xl" style={{
              background: 'linear-gradient(135deg, #00BFA5 0%, #1A73E8 100%)',
              boxShadow: '0 12px 32px rgba(0, 191, 165, 0.4)'
            }}>
              <span className="text-white text-2xl font-black">P</span>
            </div>
            <span className={`font-black transition-all duration-500 group-hover:scale-105 ${
              isScrolled ? 'text-3xl' : 'text-4xl'
            }`} style={{color: 'white', textShadow: '2px 2px 4px rgba(0,0,0,0.3)'}}>
              PeiPlay
            </span>
          </Link>
          
          {/* 強化桌面導航 */}
          <div className="hidden lg:flex items-center space-x-6">
            <Link
              href="/booking"
              className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-500 hover:scale-110 hover:shadow-2xl ${
                isActive('/booking') 
                  ? 'shadow-2xl transform scale-105' 
                  : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/booking') ? '#00BFA5' : 'transparent',
                color: 'white',
                textShadow: isActive('/booking') ? 'none' : '1px 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">🎮</span>
                預約陪玩
              </span>
            </Link>
            <Link
              href="/ranking"
              className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-500 hover:scale-110 hover:shadow-2xl ${
                isActive('/ranking') 
                  ? 'shadow-2xl transform scale-105' 
                  : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/ranking') ? '#00BFA5' : 'transparent',
                color: 'white',
                textShadow: isActive('/ranking') ? 'none' : '1px 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                排行榜
              </span>
            </Link>
            <Link
              href="/partners"
              className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-500 hover:scale-110 hover:shadow-2xl ${
                isActive('/partners') 
                  ? 'shadow-2xl transform scale-105' 
                  : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/partners') ? '#00BFA5' : 'transparent',
                color: 'white',
                textShadow: isActive('/partners') ? 'none' : '1px 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">🔍</span>
                搜尋夥伴
              </span>
            </Link>
            <Link
              href="/join"
              className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-500 hover:scale-110 hover:shadow-2xl border-2 ${
                isActive('/join') 
                  ? 'shadow-2xl transform scale-105' 
                  : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/join') ? '#00BFA5' : 'transparent',
                color: 'white',
                borderColor: 'white',
                textShadow: isActive('/join') ? 'none' : '1px 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">💼</span>
                加入我們
              </span>
            </Link>
          </div>
          
          {/* 強化用戶菜單 */}
          <div className="flex items-center gap-6">
            {/* 桌面用戶圖標 */}
            <div className="hidden md:flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 hover:shadow-xl border-2" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                borderColor: 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(10px)'
              }}>
                <span className="text-white text-xl font-bold">👤</span>
              </div>
            </div>

            {/* 強化移動菜單按鈕 */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 hover:shadow-xl border-2"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                borderColor: 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div className="flex flex-col gap-1.5">
                <div className={`w-7 h-1 bg-white transition-all duration-500 ${isMenuOpen ? 'rotate-45 translate-y-2.5' : ''}`}></div>
                <div className={`w-7 h-1 bg-white transition-all duration-500 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
                <div className={`w-7 h-1 bg-white transition-all duration-500 ${isMenuOpen ? '-rotate-45 -translate-y-2.5' : ''}`}></div>
              </div>
            </button>
          </div>
        </div>
        
        {/* 強化移動菜單 */}
        <div className={`lg:hidden mt-8 transition-all duration-500 overflow-hidden ${
          isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="space-y-4 pb-6">
            <Link
              href="/booking"
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center gap-4 px-8 py-6 rounded-2xl font-black text-xl transition-all duration-500 hover:scale-105 ${
                isActive('/booking') ? 'shadow-2xl' : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/booking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              <span className="text-3xl">🎮</span>
              預約陪玩
            </Link>
            <Link
              href="/ranking"
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center gap-4 px-8 py-6 rounded-2xl font-black text-xl transition-all duration-500 hover:scale-105 ${
                isActive('/ranking') ? 'shadow-2xl' : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/ranking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              <span className="text-3xl">🏆</span>
              排行榜
            </Link>
            <Link
              href="/partners"
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center gap-4 px-8 py-6 rounded-2xl font-black text-xl transition-all duration-500 hover:scale-105 ${
                isActive('/partners') ? 'shadow-2xl' : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/partners') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              <span className="text-3xl">🔍</span>
              搜尋夥伴
            </Link>
            <Link
              href="/join"
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center gap-4 px-8 py-6 rounded-2xl font-black text-xl transition-all duration-500 hover:scale-105 border-2 ${
                isActive('/join') ? 'shadow-2xl' : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/join') ? '#00BFA5' : 'transparent',
                color: 'white',
                borderColor: 'white'
              }}
            >
              <span className="text-3xl">💼</span>
              加入我們
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}