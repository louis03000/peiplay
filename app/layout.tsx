import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/app/providers'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { PerformanceMonitor } from '@/components/PerformanceMonitor'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PeiPlay - 遊戲夥伴預約平台',
  description: '找到最適合的遊戲夥伴，享受更好的遊戲體驗',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>
        <SessionProvider>
          <PerformanceMonitor 
            enabled={process.env.NODE_ENV === 'development'}
            onMetricsUpdate={(metrics) => {
              // 在開發環境中監控效能
              if (process.env.NODE_ENV === 'development' && metrics.fps < 30) {
                console.warn('效能警告: FPS 過低', metrics)
              }
            }}
          />
          <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </SessionProvider>
      </body>
    </html>
  )
}
