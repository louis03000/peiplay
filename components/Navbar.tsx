import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="backdrop-blur bg-white/10 border-b border-white/10 px-6 py-4 flex items-center justify-between">
      <div className="text-2xl font-bold">
        <Link href="/">PeiPlay</Link>
      </div>
      <div className="space-x-6">
        <Link href="/booking">預約</Link>
        <Link href="/partners">夥伴</Link>
        <Link href="/partner/schedule">夥伴管理</Link>
        <Link href="/join">加入我們</Link>
        <Link href="/auth/login">登入</Link>
      </div>
    </nav>
  )
} 