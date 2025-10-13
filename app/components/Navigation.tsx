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
      isScrolled ? 'py-2' : 'py-4'
    }`} style={{
      background: pathname === '/' 
        ? (isScrolled ? 'rgba(26, 115, 232, 0.95)' : 'rgba(26, 115, 232, 0.9)')
        : 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
      backdropFilter: 'blur(20px)',
      borderBottom: isScrolled ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: isScrolled ? '0 8px 32px rgba(0, 0, 0, 0.1)' : 'none'
    }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center">
          {/* Enhanced Logo */}
          <Link href="/" className="flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-12" style={{
              background: 'linear-gradient(135deg, #00BFA5 0%, #1A73E8 100%)',
              boxShadow: '0 8px 24px rgba(0, 191, 165, 0.3)'
            }}>
              <span className="text-white text-xl font-bold">P</span>
            </div>
            <span className={`font-bold transition-all duration-500 group-hover:scale-105 ${
              isScrolled ? 'text-xl' : 'text-2xl'
            }`} style={{color: 'white'}}>
              PeiPlay
            </span>
          </Link>
          
          {/* Enhanced Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-2">
            <Link
              href="/booking"
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-500 hover:scale-105 hover:shadow-lg ${
                isActive('/booking') 
                  ? 'shadow-lg transform scale-105' 
                  : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/booking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              <span className="flex items-center gap-2">
                <span>🎮</span>
                預約陪玩
              </span>
            </Link>
            <Link
              href="/ranking"
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-500 hover:scale-105 hover:shadow-lg ${
                isActive('/ranking') 
                  ? 'shadow-lg transform scale-105' 
                  : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/ranking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              <span className="flex items-center gap-2">
                <span>🏆</span>
                排行榜
              </span>
            </Link>
            <Link
              href="/partners"
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-500 hover:scale-105 hover:shadow-lg ${
                isActive('/partners') 
                  ? 'shadow-lg transform scale-105' 
                  : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/partners') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              <span className="flex items-center gap-2">
                <span>🔍</span>
                搜尋夥伴
              </span>
            </Link>
          </div>
          
          {/* Enhanced User Menu */}
          <div className="flex items-center gap-4">
            {/* Desktop User Icon */}
            <div className="hidden md:flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 hover:shadow-lg" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: '2px solid rgba(255, 255, 255, 0.3)'
              }}>
                <span className="text-white text-lg font-bold">👤</span>
              </div>
            </div>

            {/* Enhanced Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 hover:shadow-lg"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              <div className="flex flex-col gap-1">
                <div className={`w-6 h-0.5 bg-white transition-all duration-500 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
                <div className={`w-6 h-0.5 bg-white transition-all duration-500 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
                <div className={`w-6 h-0.5 bg-white transition-all duration-500 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
              </div>
            </button>
          </div>
        </div>
        
        {/* Enhanced Mobile Menu */}
        <div className={`lg:hidden mt-6 transition-all duration-500 overflow-hidden ${
          isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="space-y-3 pb-6">
            <Link
              href="/booking"
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold transition-all duration-500 hover:scale-105 ${
                isActive('/booking') ? 'shadow-lg' : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/booking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              <span>🎮</span>
              預約陪玩
            </Link>
            <Link
              href="/ranking"
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold transition-all duration-500 hover:scale-105 ${
                isActive('/ranking') ? 'shadow-lg' : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/ranking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              <span>🏆</span>
              排行榜
            </Link>
            <Link
              href="/partners"
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold transition-all duration-500 hover:scale-105 ${
                isActive('/partners') ? 'shadow-lg' : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/partners') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              <span>🔍</span>
              搜尋夥伴
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}