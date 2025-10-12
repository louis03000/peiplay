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
      <div className="max-w-5xl mx-auto px-8 sm:px-12 lg:px-16">
        <div className="flex justify-center items-center text-center">
          {/* Logo */}
          <div className="flex-shrink-0 mr-16">
            <Link href="/" className="text-2xl font-bold text-black text-center" style={{color: 'black'}}>
              PeiPlay
            </Link>
          </div>
          
          {/* Navigation Links */}
          <div className="flex items-center space-x-8 text-center">
            <Link
              href="/booking"
              className="bg-white text-black border-2 border-black font-medium py-2 px-6 hover:bg-gray-100 transition-colors text-center"
              style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
            >
              預約
            </Link>
            <Link
              href="/ranking"
              className="bg-white text-black border-2 border-black font-medium py-2 px-6 hover:bg-gray-100 transition-colors text-center"
              style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
            >
              排行榜
            </Link>
            <Link
              href="/partners"
              className="bg-white text-black border-2 border-black font-medium py-2 px-6 hover:bg-gray-100 transition-colors text-center"
              style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
            >
              搜尋
            </Link>
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center ml-6">
              <span className="text-white text-sm font-bold">I</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 