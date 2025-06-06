import type { Metadata } from "next";
import "./globals.css";
import ClientNavbar from './components/ClientNavbar'
import Footer from '../components/Footer'
import { Inter } from 'next/font/google'
import Providers from './providers'
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === 'authenticated') {
      const user = session?.user;
      if (user && (!user.phone || !user.birthday)) {
        router.replace('/onboarding');
      }
    }
  }, [session, status, router]);

  return (
    <html lang="zh-TW">
      <body>
        <Providers>
          <ClientNavbar />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
