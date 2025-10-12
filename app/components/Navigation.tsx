'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <nav className="py-4" style={{backgroundColor: '#1A73E8'}}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold" style={{color: 'white'}}>
            PeiPlay
          </Link>
          
          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/booking"
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/booking') 
                  ? 'shadow-md' 
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: isActive('/booking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              預約
            </Link>
            <Link
              href="/ranking"
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/ranking') 
                  ? 'shadow-md' 
                  : 'hover:opacity-80'
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
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/partners') 
                  ? 'shadow-md' 
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: isActive('/partners') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              搜尋
            </Link>
          </div>
          
          {/* User Icon */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: 'rgba(255, 255, 255, 0.2)'}}>
            <span className="text-white text-sm font-bold">I</span>
          </div>
        </div>
        
        {/* Mobile Menu */}
        <div className="md:hidden mt-4">
          <div className="flex justify-center space-x-4">
            <Link
              href="/booking"
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/booking') ? 'shadow-md' : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: isActive('/booking') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              預約
            </Link>
            <Link
              href="/ranking"
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/ranking') ? 'shadow-md' : 'hover:opacity-80'
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
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/partners') ? 'shadow-md' : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: isActive('/partners') ? '#00BFA5' : 'transparent',
                color: 'white'
              }}
            >
              搜尋
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
} 