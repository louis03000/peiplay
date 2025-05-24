'use client'

import { useSession } from 'next-auth/react';

export default function Home() {
  const { data: session, status } = useSession();
  console.log('session', session, status);
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#23243a] via-[#2d2e4a] to-[#1a1b2b]">
      <main className="flex-1 flex flex-col items-center justify-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white text-center">PeiPlay 預約平台</h1>
        <p className="text-lg md:text-2xl text-gray-300 mb-8 text-center">專為顧客與夥伴打造的預約與管理系統。</p>
        <pre className="text-xs text-white bg-black/50 p-2 rounded mt-4 max-w-xl w-full break-all">
          {JSON.stringify({ session, status }, null, 2)}
        </pre>
      </main>
      <footer className="w-full text-center py-6 text-gray-400 bg-gradient-to-r from-[#23243a] to-[#2d2e4a] text-sm">
        © 2025 PeiPlay. All rights reserved.
      </footer>
      </div>
  )
}
