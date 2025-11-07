'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import InfoCard from '@/components/partner/InfoCard';
import { 
  FaGamepad, 
  FaUsers, 
  FaCalendarAlt, 
  FaGift, 
  FaBolt, 
  FaShieldAlt, 
  FaHeart,
  FaStar,
  FaCrown,
  FaRocket
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

  // 功能導向的入口卡片，不是數據導向
  const quickActions = [
    {
      title: '立即預約',
      description: '尋找專業夥伴，開始精彩的遊戲體驗',
      icon: <FaGamepad className="text-3xl" />,
      color: 'from-blue-500 to-purple-600',
      href: '/booking',
      show: true
    },
    {
      title: '瀏覽夥伴',
      description: '探索優質陪玩夥伴，找到最適合你的',
      icon: <FaStar className="text-3xl" />,
      color: 'from-yellow-500 to-orange-600',
      href: '/partners',
      show: true
    },
    {
      title: '成為夥伴',
      description: '加入我們，分享技能，開創收入',
      icon: <FaUsers className="text-3xl" />,
      color: 'from-green-500 to-teal-600',
      href: '/join',
      show: status !== 'authenticated' || !isPartner
    },
    {
      title: '我的服務',
      description: '管理時段、查看訂單、申請提領',
      icon: <FaCalendarAlt className="text-3xl" />,
      color: 'from-orange-500 to-red-600',
      href: '/partner/schedule',
      show: isPartner
    },
    {
      title: '我的預約',
      description: '查看預約記錄，管理您的訂單',
      icon: <FaCalendarAlt className="text-3xl" />,
      color: 'from-indigo-500 to-blue-600',
      href: '/bookings',
      show: status === 'authenticated' && !isPartner
    },
    {
      title: '推薦好友',
      description: '邀請朋友加入，一起享受獎勵',
      icon: <FaGift className="text-3xl" />,
      color: 'from-pink-500 to-rose-600',
      href: isPartner ? '/partner/referral' : '/join',
      show: true
    }
  ].filter(action => action.show);

  return (
    <div className="min-h-screen bg-[#F8F9FB] snap-y snap-mandatory overflow-y-scroll h-screen">
      {/* Hero Section - 第 1 屏 */}
      <div className="relative bg-gradient-to-br from-[#6C63FF] via-[#5a52e6] to-[#4a42d6] overflow-hidden min-h-screen flex items-center snap-start snap-always">
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
                    onClick={() => router.push('/partners')}
                    className="w-full sm:w-auto border-2 border-white text-white px-10 py-4 rounded-2xl text-lg font-semibold hover:bg-white hover:text-[#6C63FF] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    瀏覽夥伴
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

      {/* 探索入口 - 第 2 屏 */}
      <div className="min-h-screen flex items-center snap-start snap-always bg-[#F8F9FB]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
            {status === 'authenticated' 
              ? isPartner 
                ? '夥伴專區' 
                : '探索更多'
              : '開始探索'}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto font-light leading-relaxed">
            {status === 'authenticated'
              ? isPartner
                ? '管理您的服務，提供最優質的陪玩體驗'
                : '發現更多遊戲可能，找到最適合的夥伴'
              : '無論是尋找陪玩，還是成為陪玩者，這裡都是您的最佳選擇'}
          </p>
        </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => router.push(action.href)}
                className="group text-left transform hover:scale-105 transition-all duration-300"
              >
                <InfoCard className="h-full hover:shadow-2xl transition-shadow duration-300" padding="lg">
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-6 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}>
                    {action.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-[#6C63FF] transition-colors duration-300">{action.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{action.description}</p>
                </InfoCard>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 服務亮點 - 第 3 屏 */}
      <div className="bg-white min-h-screen flex items-center snap-start snap-always">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
              為什麼選擇 PeiPlay
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
              我們致力於提供最優質的遊戲陪玩服務，讓每次體驗都值得期待
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            <div className="text-center group">
              <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-blue-500 to-[#6C63FF] flex items-center justify-center text-white shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300">
                <FaBolt className="text-5xl" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-5 group-hover:text-[#6C63FF] transition-colors duration-300">即時預約</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                找到現在有空的夥伴，立即開始遊戲，無需等待
              </p>
            </div>
            <div className="text-center group">
              <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300">
                <FaShieldAlt className="text-5xl" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-5 group-hover:text-[#6C63FF] transition-colors duration-300">安全保障</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                實名認證、評價系統，確保每次服務都有品質保證
              </p>
            </div>
            <div className="text-center group">
              <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300">
                <FaHeart className="text-5xl" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-5 group-hover:text-[#6C63FF] transition-colors duration-300">貼心服務</h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                24/7 客服支援，專業團隊隨時為您解決問題
              </p>
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
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-6">聯絡我們</h4>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-center">
                  <span>客服信箱：support@peiplay.com</span>
                </li>
                <li className="flex items-center">
                  <span>服務時間：24/7</span>
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
