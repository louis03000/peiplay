'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import InfoCard from '@/components/partner/InfoCard';
import { 
  FaCrown,
  FaRocket,
  FaGift
} from 'react-icons/fa';

interface Stats {
  totalPartners?: number;
  totalBookings?: number;
  activeUsers?: number;
}

interface UserStats {
  totalEarnings?: number;
  totalOrders?: number;
  availableBalance?: number;
  myBookings?: number;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isPartner, setIsPartner] = useState(false);
  const [platformStats, setPlatformStats] = useState<Stats>({});
  const [userStats, setUserStats] = useState<UserStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      checkPartnerStatus();
      loadUserStats();
    }
    loadPlatformStats();
  }, [session, status]);

  const checkPartnerStatus = async () => {
    // 優化：優先使用 session 中的伙伴信息
    if (session?.user?.partnerId) {
      setIsPartner(session.user.partnerStatus === 'APPROVED');
      return;
    }
    
    // 如果 session 中沒有，才查詢 API
    try {
      const res = await fetch('/api/partners/self');
      if (res.ok) {
        const data = await res.json();
        setIsPartner(data?.partner?.status === 'APPROVED');
      }
    } catch (error) {
      console.error('檢查夥伴狀態失敗:', error);
    }
  };

  const loadPlatformStats = async () => {
    try {
      // 可以添加平台統計 API
      setPlatformStats({
        totalPartners: 150,
        totalBookings: 2500,
        activeUsers: 800
      });
    } catch (error) {
      console.error('載入平台統計失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    try {
      if (isPartner) {
        const res = await fetch('/api/partners/withdrawal/stats');
        if (res.ok) {
          const data = await res.json();
          setUserStats({
            totalEarnings: data.totalEarnings,
            totalOrders: data.totalOrders,
            availableBalance: data.availableBalance
          });
        }
      } else {
        // 載入用戶預約統計
        const res = await fetch('/api/bookings/me');
        if (res.ok) {
          const data = await res.json();
          setUserStats({
            myBookings: data.bookings?.length || 0
          });
        }
      }
    } catch (error) {
      console.error('載入用戶統計失敗:', error);
    }
  };


  const heroBackgroundStyle = {
    backgroundImage:
      "linear-gradient(135deg, rgba(108, 99, 255, 0.85) 0%, rgba(90, 82, 230, 0.9) 50%, rgba(74, 66, 214, 0.92) 100%), url('/images/hero-gaming.jpg.png')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  } as const;

  return (
    <div className="min-h-screen bg-[#F8F9FB] snap-y snap-mandatory overflow-y-scroll h-screen">
      {/* Hero Section - 第 1 屏 */}
      <div
        className="relative overflow-hidden min-h-screen flex items-center snap-start snap-always"
        style={heroBackgroundStyle}
      >
        {/* 背景裝飾 - 增強層次感 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl transform translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white rounded-full blur-2xl transform -translate-x-1/2 -translate-y-1/2 opacity-5"></div>
        </div>

        {/* 幾何裝飾元素 */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 right-20 w-32 h-32 border-4 border-white rounded-2xl rotate-12"></div>
          <div className="absolute bottom-20 left-20 w-24 h-24 border-4 border-white rounded-full"></div>
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight tracking-tight">
              {status === 'authenticated' && isPartner 
                ? `歡迎回來，${session?.user?.name || '夥伴'}` 
                : status === 'authenticated'
                ? '準備好開始遊戲了嗎？'
                : '找到你的遊戲夥伴'}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
              {status === 'authenticated' && isPartner
                ? '隨心安排你的時間，陪玩也能成為一種享受'
                : '專業的遊戲陪練平台，讓遊戲更有趣，技能更精進'}
            </p>
            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
              {status === 'authenticated' ? (
                <>
                  <button
                    onClick={() => router.push(isPartner ? '/partner/schedule' : '/booking')}
                    className="w-full sm:w-auto bg-white text-[#6C63FF] px-10 py-4 rounded-2xl text-lg font-semibold hover:bg-gray-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1"
                  >
                    {isPartner ? '管理時段' : '立即預約'}
                  </button>
                  <button
                    onClick={() => router.push('/bookings')}
                    className="w-full sm:w-auto border-2 border-white text-white px-10 py-4 rounded-2xl text-lg font-semibold hover:bg-white hover:text-[#6C63FF] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    預約管理
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/auth/register')}
                    className="w-full sm:w-auto bg-white text-[#6C63FF] px-10 py-4 rounded-2xl text-lg font-semibold hover:bg-gray-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1"
                  >
                    立即註冊
                  </button>
                  <button
                    onClick={() => router.push('/auth/login')}
                    className="w-full sm:w-auto border-2 border-white text-white px-10 py-4 rounded-2xl text-lg font-semibold hover:bg-white hover:text-[#6C63FF] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    登入
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 平台動態 - 第 4 屏 */}
      <div className="min-h-screen flex items-center snap-start snap-always bg-[#F8F9FB]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
            平台動態
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto font-light leading-relaxed">
            探索社群最新活動，感受平台的熱情與活力
          </p>
        </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            <InfoCard className="hover:shadow-2xl transition-all duration-300 transform hover:scale-105" padding="lg">
              <div className="flex items-start space-x-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <FaRocket className="text-white text-2xl" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">新功能上線</h3>
                  <p className="text-gray-600 leading-relaxed mb-3">
                    群組預約功能正式推出，邀請好友一起玩更有趣！
                  </p>
                  <span className="text-sm text-gray-500 font-medium">2天前</span>
                </div>
              </div>
            </InfoCard>

            <InfoCard className="hover:shadow-2xl transition-all duration-300 transform hover:scale-105" padding="lg">
              <div className="flex items-start space-x-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <FaCrown className="text-white text-2xl" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">本月之星</h3>
                  <p className="text-gray-600 leading-relaxed mb-3">
                    恭喜優秀夥伴們獲得「五星好評」榮譽徽章！
                  </p>
                  <span className="text-sm text-gray-500 font-medium">5天前</span>
                </div>
              </div>
            </InfoCard>

            <InfoCard className="hover:shadow-2xl transition-all duration-300 transform hover:scale-105" padding="lg">
              <div className="flex items-start space-x-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <FaGift className="text-white text-2xl" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">推薦計畫</h3>
                  <p className="text-gray-600 leading-relaxed mb-3">
                    邀請好友一起加入，共享平台成長紅利！
                  </p>
                  <span className="text-sm text-gray-500 font-medium">1週前</span>
                </div>
              </div>
            </InfoCard>
          </div>
        </div>
      </div>

      {/* CTA Section - 第 5 屏（僅未登入用戶顯示）*/}
      {status !== 'authenticated' && (
        <div className="relative bg-gradient-to-br from-[#6C63FF] via-[#5a52e6] to-[#4a42d6] overflow-hidden min-h-screen flex items-center snap-start snap-always">
          {/* 背景裝飾 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          </div>

          <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center w-full">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-8 tracking-tight leading-tight">
              準備開始你的遊戲之旅？
            </h2>
            <p className="text-xl sm:text-2xl text-white/90 mb-12 max-w-3xl mx-auto font-light leading-relaxed">
              立即註冊，找到最適合你的遊戲夥伴，開啟全新的遊戲體驗
            </p>
            <button
              onClick={() => router.push('/auth/register')}
              className="bg-white text-[#6C63FF] px-12 py-5 rounded-2xl text-xl font-semibold hover:bg-gray-50 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-105 hover:-translate-y-1"
            >
              免費註冊
            </button>
          </div>
        </div>
      )}

      {/* Footer - 不需全屏，自然高度 */}
      <footer className="bg-gray-900 text-white py-16 sm:py-20 snap-start">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 lg:gap-12 mb-12">
            <div>
              <h3 className="text-2xl font-bold mb-6 text-[#6C63FF]">PeiPlay</h3>
              <p className="text-gray-400 leading-relaxed">
                專業的遊戲陪玩平台，讓遊戲更有趣
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-6">快速連結</h4>
              <ul className="space-y-3">
                <li><a href="/booking" className="text-gray-400 hover:text-white transition-colors duration-300 hover:translate-x-1 inline-block">預約服務</a></li>
                <li><a href="/partners" className="text-gray-400 hover:text-white transition-colors duration-300 hover:translate-x-1 inline-block">瀏覽夥伴</a></li>
                <li><a href="/join" className="text-gray-400 hover:text-white transition-colors duration-300 hover:translate-x-1 inline-block">成為夥伴</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-6">幫助中心</h4>
              <ul className="space-y-3">
                <li><a href="/guidelines" className="text-gray-400 hover:text-white transition-colors duration-300 hover:translate-x-1 inline-block">使用指南</a></li>
                <li><a href="/contract" className="text-gray-400 hover:text-white transition-colors duration-300 hover:translate-x-1 inline-block">服務條款</a></li>
                <li><a href="/refund-policy" className="text-gray-400 hover:text-white transition-colors duration-300 hover:translate-x-1 inline-block">退款規則</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-6">聯絡我們</h4>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-center">
                  <span>客服信箱：peiplay987@gmail.com</span>
                </li>
                <li className="flex items-center">
                  <span>Line：@484mkuzi</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-10 text-center">
            <p className="text-gray-400 text-sm">&copy; 2024 PeiPlay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
