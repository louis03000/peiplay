'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <div className="bg-white text-black py-4 border-b border-gray-200" style={{backgroundColor: 'white', color: 'black'}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center text-center">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-bold text-black text-center" style={{color: 'black'}}>
              PeiPlay
            </Link>
          </div>
          
          {/* Navigation Links */}
          <div className="flex items-center space-x-8 text-center">
            <Link
              href="/booking"
              className="bg-white text-black border-2 border-black font-medium py-2 px-4 hover:bg-gray-100 transition-colors"
              style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
            >
              預約
            </Link>
            <Link
              href="/ranking"
              className="bg-white text-black border-2 border-black font-medium py-2 px-4 hover:bg-gray-100 transition-colors"
              style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
            >
              排行榜
            </Link>
            <Link
              href="/partners"
              className="bg-white text-black border-2 border-black font-medium py-2 px-4 hover:bg-gray-100 transition-colors"
              style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
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