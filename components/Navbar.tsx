'use client'

import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="backdrop-blur bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border-b border-white/10 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          <Link href="/">PeiPlay</Link>
        </div>
        <div className="flex gap-8">
          <Link href="/booking">預約</Link>
          <Link href="/partners">夥伴</Link>
          <Link href="/join">加入我們</Link>
        </div>
      </div>
    </nav>
  )
} 