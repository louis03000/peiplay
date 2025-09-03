'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, useRef } from 'react'

export default function Navbar() {
  const { data: session } = useSession()
  const [hasPartner, setHasPartner] = useState(false)
  const [isPartner, setIsPartner] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/partners/self')
      .then(res => {
        if (!res.ok) {
          // If response is not OK, don't proceed with JSON parsing
          return res.json().then(errorData => {
            throw new Error(errorData.error || 'Failed to fetch partner status');
          });
        }
        return res.json();
      })
      .then(data => {
        if (data && data.partner) {
          setHasPartner(data.partner.status === 'APPROVED');
          setIsPartner(true);
        } else {
          setHasPartner(false);
          setIsPartner(false);
        }
      }).catch(() => {
        setHasPartner(false);
        setIsPartner(false);
      })
    } else {
      setHasPartner(false)
      setIsPartner(false)
    }
  }, [session])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [menuRef])

  return (
    <nav className="backdrop-blur bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border-b border-white/10 px-4 sm:px-6 py-4 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          <Link href="/">PeiPlay</Link>
        </div>
        <div className="flex gap-2 sm:gap-4 md:gap-8 items-center text-white">
          <Link href="/booking" className="hover:text-purple-300 transition-colors text-sm sm:text-base">預約</Link>
          <Link href="/ranking" className="hover:text-purple-300 transition-colors text-sm sm:text-base">排行榜</Link>
          <Link href="/partners" className="hover:text-purple-300 transition-colors text-sm sm:text-base">搜尋</Link>
          <Link href="/recharge" className="hover:text-yellow-300 transition-colors text-sm sm:text-base flex items-center gap-1">
            <span className="text-yellow-400">🪙</span>
            商店
          </Link>
          {!isPartner && <Link href="/join" className="hover:text-purple-300 transition-colors text-sm sm:text-base hidden sm:inline">加入我們</Link>}
          
          <div className="relative" ref={menuRef}>
            {session?.user ? (
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-500 flex items-center justify-center text-sm sm:text-lg font-bold border-2 border-transparent hover:border-purple-400 transition-all">
                {session.user.name?.charAt(0) || session.user.email?.charAt(0)}
              </button>
            ) : (
              <Link href="/auth/login" className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 transition-colors font-semibold text-sm sm:text-base">登入</Link>
            )}

            {menuOpen && session?.user && (
              <div className="absolute right-0 md:left-1/2 md:-translate-x-1/2 mt-3 w-48 sm:w-56 bg-white/90 rounded-md shadow-lg py-2 border border-white/40">
                <div className="px-3 sm:px-4 py-3 border-b border-white/40 text-center">
                  <p className="text-xs sm:text-sm text-gray-500">Signed in as</p>
                  <p className="font-semibold truncate text-gray-900 text-sm sm:text-base">{session.user.name || session.user.email}</p>
                </div>
                
                {/* 管理員功能 */}
                  {session?.user?.role === 'ADMIN' && (
                  <div className="mt-2">
                    <Link href="/admin/partners" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-center">
                      🔧 夥伴審核
                    </Link>
                  </div>
                  )}
                
                {/* 夥伴功能 */}
                  {isPartner && (
                  <div className="mt-2">
                    <Link href="/partner/schedule" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-center">
                      📅 時段管理
                    </Link>
                  </div>
                )}
                
                {/* 預約管理 - 所有用戶都可以訪問 */}
                <div className="mt-2">
                  <Link href="/bookings" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-center">
                    📋 預約管理
                  </Link>
                </div>
                
                {/* 個人資料 */}
                <div className="mt-2">
                  <Link href="/profile" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors text-center">
                    👤 個人資料
                  </Link>
                </div>
                
                <div className="border-t border-white/40 mt-2">
                  <button 
                    onClick={() => signOut()} 
                    className="block w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors text-center"
                  >
                    登出
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
} 