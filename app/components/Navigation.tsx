'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <div className="bg-white text-black py-4 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-bold text-black">
              PeiPlay
            </Link>
          </div>
          
          {/* Navigation Links */}
          <div className="flex items-center space-x-8">
            <Link
              href="/booking"
              className="text-black hover:text-gray-600 transition-colors font-medium"
            >
              預約
            </Link>
            <Link
              href="/ranking"
              className="text-black hover:text-gray-600 transition-colors font-medium"
            >
              排行榜
            </Link>
            <Link
              href="/partners"
              className="text-black hover:text-gray-600 transition-colors font-medium"
            >
              搜尋
            </Link>
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center ml-2">
              <span className="text-white text-sm font-bold">I</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 