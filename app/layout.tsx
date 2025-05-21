import type { Metadata } from "next";
import "./globals.css";
import Navigation from "./components/Navigation";
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

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
    <html lang="zh-Hant">
      <body className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 min-h-screen text-white font-sans">
        <Navbar />
        <main className="container mx-auto py-8 min-h-[80vh]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
