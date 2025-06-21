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
        <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          <Link href="/">PeiPlay</Link>
        </div>
        <div className="flex gap-4 sm:gap-8 items-center text-white">
          <Link href="/booking" className="hover:text-purple-300 transition-colors">預約</Link>
          <Link href="/partners" className="hover:text-purple-300 transition-colors">夥伴</Link>
          {!isPartner && <Link href="/join" className="hover:text-purple-300 transition-colors">加入我們</Link>}
          
          <div className="relative" ref={menuRef}>
            {session?.user ? (
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-lg font-bold border-2 border-transparent hover:border-purple-400 transition-all">
                {session.user.name?.charAt(0) || session.user.email?.charAt(0)}
              </button>
            ) : (
              <Link href="/auth/login" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 transition-colors font-semibold">登入</Link>
            )}

            {menuOpen && session?.user && (
              <div className="absolute right-0 mt-2 w-48 bg-white/10 backdrop-blur-lg rounded-md shadow-lg py-2 border border-white/20">
                <div className="px-4 py-2 border-b border-white/20">
                  <p className="text-sm text-gray-400">Signed in as</p>
                  <p className="font-semibold truncate">{session.user.name || session.user.email}</p>
                </div>
                <div className="mt-2">
                  {session?.user?.role === 'ADMIN' && (
                    <Link href="/admin/partners" className="block w-full text-left px-4 py-2 text-sm hover:bg-white/20 transition-colors">夥伴審核</Link>
                  )}
                  {isPartner && (
                    <Link href="/partner/schedule" className="block w-full text-left px-4 py-2 text-sm hover:bg-white/20 transition-colors">時段管理</Link>
                  )}
                  {session.user.role === 'CUSTOMER' && (
                    <Link href="/profile" className="block w-full text-left px-4 py-2 text-sm hover:bg-white/20 transition-colors">我的預約</Link>
                  )}
                  {(session.user.role === 'ADMIN' || isPartner) && (
                    <Link href="/bookings" className="block w-full text-left px-4 py-2 text-sm hover:bg-white/20 transition-colors">查詢預約</Link>
                  )}
                </div>
                <div className="border-t border-white/20 mt-2">
                  <button 
                    onClick={() => signOut()} 
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/50 hover:text-white transition-colors"
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