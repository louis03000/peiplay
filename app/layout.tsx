import type { Metadata } from "next";
import "./globals.css";
import ClientNavbar from './components/ClientNavbar'
import Footer from '../components/Footer'
import { Inter } from 'next/font/google'
import Providers from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "陪玩預約系統",
  description: "找到最適合您的遊戲夥伴，享受愉快的遊戲時光",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>
        <Providers>
          <ClientNavbar />
          <main className="pt-20">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
