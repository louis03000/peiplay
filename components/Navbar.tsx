'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <nav className="backdrop-blur bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border-b border-white/10 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          <Link href="/">PeiPlay</Link>
        </div>
        <div className="space-x-6">
          <Link 
            href="/booking" 
            className={`hover:text-purple-400 transition-colors ${
              isActive('/booking') ? 'text-purple-400' : 'text-gray-300'
            }`}
          >
            預約
          </Link>
          <Link 
            href="/partners" 
            className={`hover:text-purple-400 transition-colors ${
              isActive('/partners') ? 'text-purple-400' : 'text-gray-300'
            }`}
          >
            夥伴
          </Link>
          <Link 
            href="/partner/schedule" 
            className={`hover:text-purple-400 transition-colors ${
              isActive('/partner/schedule') ? 'text-purple-400' : 'text-gray-300'
            }`}
          >
            夥伴管理
          </Link>
          <Link 
            href="/join" 
            className={`hover:text-purple-400 transition-colors ${
              isActive('/join') ? 'text-purple-400' : 'text-gray-300'
            }`}
          >
            加入我們
          </Link>
          <Link 
            href="/auth/login" 
            className={`hover:text-purple-400 transition-colors ${
              isActive('/auth/login') ? 'text-purple-400' : 'text-gray-300'
            }`}
          >
            登入
          </Link>
        </div>
      </div>
    </nav>
  )
} 