import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from './providers'
import ClientNavbar from './components/ClientNavbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PeiPlay - 遊戲夥伴預約平台',
  description: '專為顧客與夥伴打造的預約與管理系統',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-[#0f172a]">
            <ClientNavbar />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
