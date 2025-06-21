'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const { data: session } = useSession();
  const [hasPartner, setHasPartner] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/partners/self').then(res => res.json()).then(data => {
        setHasPartner(!!data.partner && data.partner.status === 'APPROVED');
        setIsPartner(!!data.partner);
      });
    } else {
      setHasPartner(false);
      setIsPartner(false);
    }
  }, [session]);
  console.log('session', session);
  return (
    <nav className="backdrop-blur bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border-b border-white/10 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          <Link href="/">PeiPlay</Link>
        </div>
        <div className="flex gap-8 items-center">
          <Link href="/booking">預約</Link>
          <Link href="/partners">夥伴</Link>
          {!hasPartner && <Link href="/join">加入我們</Link>}
          {session?.user?.role === 'ADMIN' && (
            <Link href="/admin/partners" className="text-purple-600 font-bold hover:underline">夥伴審核</Link>
          )}
          {isPartner && (
            <Link href="/partner/schedule" className="text-indigo-600 font-bold hover:underline">時段管理</Link>
          )}
          {session?.user && (
            <Link href="/bookings" className="text-indigo-600 font-bold hover:underline">查詢預約</Link>
          )}
          {session?.user ? (
            <>
              <span className="text-gray-700 font-medium">{session.user.name || session.user.email}</span>
              <button onClick={() => signOut()} className="text-red-600 font-bold hover:underline ml-2">登出</button>
            </>
          ) : (
            <Link href="/auth/login" className="text-indigo-600 font-bold hover:underline">登入</Link>
          )}
        </div>
      </div>
    </nav>
  )
} 