'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export default function Navigation() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 py-4 transition-all duration-300" style={{
      background: pathname === '/' 
        ? 'rgba(26, 115, 232, 0.95)' 
        : 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110" style={{
              background: 'linear-gradient(135deg, #00BFA5 0%, #1A73E8 100%)'
            }}>
              <span className="text-white text-xl font-bold">P</span>
            </div>
            <span className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
              PeiPlay
            </span>
          </Link>
          
          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-2">
            <Link
              href="/booking"
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${
                isActive('/booking') 
                  ? 'shadow-lg transform scale-105' 
                  : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/booking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              預約陪玩
            </Link>
            <Link
              href="/ranking"
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${
                isActive('/ranking') 
                  ? 'shadow-lg transform scale-105' 
                  : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/ranking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              排行榜
            </Link>
            <Link
              href="/partners"
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${
                isActive('/partners') 
                  ? 'shadow-lg transform scale-105' 
                  : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/partners') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              搜尋夥伴
            </Link>
          </div>
          
          {/* User Menu */}
          <div className="flex items-center gap-4">
            {/* Desktop User Icon */}
            <div className="hidden md:flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: '2px solid rgba(255, 255, 255, 0.3)'
              }}>
                <span className="text-white text-sm font-bold">👤</span>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              <div className="flex flex-col gap-1">
                <div className={`w-5 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></div>
                <div className={`w-5 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></div>
                <div className={`w-5 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></div>
              </div>
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        <div className={`lg:hidden mt-6 transition-all duration-300 overflow-hidden ${
          isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="space-y-3 pb-4">
            <Link
              href="/booking"
              onClick={() => setIsMenuOpen(false)}
              className={`block px-6 py-4 rounded-xl font-medium transition-all duration-300 ${
                isActive('/booking') ? 'shadow-lg' : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/booking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              預約陪玩
            </Link>
            <Link
              href="/ranking"
              onClick={() => setIsMenuOpen(false)}
              className={`block px-6 py-4 rounded-xl font-medium transition-all duration-300 ${
                isActive('/ranking') ? 'shadow-lg' : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/ranking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              排行榜
            </Link>
            <Link
              href="/partners"
              onClick={() => setIsMenuOpen(false)}
              className={`block px-6 py-4 rounded-xl font-medium transition-all duration-300 ${
                isActive('/partners') ? 'shadow-lg' : 'hover:bg-white hover:bg-opacity-20'
              }`}
              style={{
                backgroundColor: isActive('/partners') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              搜尋夥伴
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}