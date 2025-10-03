import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from './providers'
import ClientNavbar from './components/ClientNavbar'
import SuspensionNotice from './components/SuspensionNotice'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

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
            <SuspensionNotice />
            <ClientNavbar />
            {children}
          </div>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
          />
        </Providers>
      </body>
    </html>
  )
}
