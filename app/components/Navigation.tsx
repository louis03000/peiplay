'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <nav className="bg-palette-400 shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-palette-800">
                遊戲夥伴預約系統
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/')
                    ? 'border-palette-800 text-palette-900'
                    : 'border-transparent text-palette-600 hover:border-palette-700 hover:text-palette-800'
                }`}
              >
                首頁
              </Link>
              <Link
                href="/partners"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/partners')
                    ? 'border-palette-800 text-palette-900'
                    : 'border-transparent text-palette-600 hover:border-palette-700 hover:text-palette-800'
                }`}
              >
                夥伴列表
              </Link>
              <Link
                href="/booking"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/booking')
                    ? 'border-palette-800 text-palette-900'
                    : 'border-transparent text-palette-600 hover:border-palette-700 hover:text-palette-800'
                }`}
              >
                預約
              </Link>
              <Link
                href="/join"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/join')
                    ? 'border-palette-800 text-palette-900'
                    : 'border-transparent text-palette-600 hover:border-palette-700 hover:text-palette-800'
                }`}
              >
                加入我們
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
} 