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

  const quickActions = [
    {
      title: '預約陪玩',
      description: '尋找專業夥伴，立即開始遊戲',
      icon: <FaGamepad className="text-3xl" />,
      color: 'from-blue-500 to-purple-600',
      href: '/booking',
      show: true
    },
    {
      title: '成為夥伴',
      description: '分享遊戲技能，賺取收入',
      icon: <FaUsers className="text-3xl" />,
      color: 'from-green-500 to-teal-600',
      href: '/join',
      show: !isPartner && status === 'authenticated'
    },
    {
      title: '時段管理',
      description: '管理您的可預約時間',
      icon: <FaCalendarAlt className="text-3xl" />,
      color: 'from-orange-500 to-red-600',
      href: '/partner/schedule',
      show: isPartner
    },
    {
      title: '推薦系統',
      description: '邀請好友，獲得獎勵',
      icon: <FaGift className="text-3xl" />,
      color: 'from-pink-500 to-rose-600',
      href: '/partner/referral',
      show: isPartner
    },
    {
      title: '我的預約',
      description: '查看預約記錄和訂單',
      icon: <FaCalendarAlt className="text-3xl" />,
      color: 'from-indigo-500 to-blue-600',
      href: '/bookings',
      show: status === 'authenticated'
    },
    {
      title: '瀏覽夥伴',
      description: '探索更多優質夥伴',
      icon: <FaStar className="text-3xl" />,
      color: 'from-yellow-500 to-orange-600',
      href: '/partners',
      show: true
    }
  ].filter(action => action.show);

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-[#6C63FF] via-[#5a52e6] to-[#4a42d6] overflow-hidden">
        {/* 背景裝飾 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl transform translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="relative container mx-auto px-4 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              {status === 'authenticated' && isPartner 
                ? '歡迎回來，夥伴！' 
                : status === 'authenticated'
                ? '準備好開始遊戲了嗎？'
                : '找到你的遊戲夥伴'}
            </h1>
            <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              {status === 'authenticated' && isPartner
                ? '管理您的時段、查看收入，提供最專業的遊戲陪玩服務'
                : '專業的遊戲陪練平台，讓遊戲更有趣，技能更精進'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {status === 'authenticated' ? (
                <>
                  <button
                    onClick={() => router.push(isPartner ? '/partner/schedule' : '/booking')}
                    className="bg-white text-[#6C63FF] px-8 py-4 rounded-2xl text-lg font-semibold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {isPartner ? '管理時段' : '立即預約'}
                  </button>
                  <button
                    onClick={() => router.push('/partners')}
                    className="border-2 border-white text-white px-8 py-4 rounded-2xl text-lg font-semibold hover:bg-white hover:text-[#6C63FF] transition-all duration-300"
                  >
                    瀏覽夥伴
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/auth/register')}
                    className="bg-white text-[#6C63FF] px-8 py-4 rounded-2xl text-lg font-semibold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    立即註冊
                  </button>
                  <button
                    onClick={() => router.push('/auth/login')}
                    className="border-2 border-white text-white px-8 py-4 rounded-2xl text-lg font-semibold hover:bg-white hover:text-[#6C63FF] transition-all duration-300"
                  >
                    登入
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 關鍵數據區 */}
      {status === 'authenticated' && (
        <div className="container mx-auto px-4 py-8 sm:py-12 -mt-8 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {isPartner ? (
              <>
                <InfoCard className="text-center transform hover:scale-105 transition-all duration-300">
                  <div className="text-[#6C63FF] text-4xl mb-2">{userStats.totalOrders || 0}</div>
                  <div className="text-gray-600 text-sm font-medium">總接單數</div>
                </InfoCard>
                <InfoCard className="text-center transform hover:scale-105 transition-all duration-300">
                  <div className="text-green-600 text-4xl mb-2">
                    ${Math.round(userStats.totalEarnings || 0)}
                  </div>
                  <div className="text-gray-600 text-sm font-medium">總收入</div>
                </InfoCard>
                <InfoCard className="text-center transform hover:scale-105 transition-all duration-300">
                  <div className="text-blue-600 text-4xl mb-2">
                    ${Math.round(userStats.availableBalance || 0)}
                  </div>
                  <div className="text-gray-600 text-sm font-medium">可提領餘額</div>
                </InfoCard>
                <InfoCard className="text-center transform hover:scale-105 transition-all duration-300">
                  <div className="text-orange-600 text-4xl mb-2">5.0</div>
                  <div className="text-gray-600 text-sm font-medium">平均評分</div>
                </InfoCard>
              </>
            ) : (
              <>
                <InfoCard className="text-center transform hover:scale-105 transition-all duration-300">
                  <div className="text-[#6C63FF] text-4xl mb-2">{userStats.myBookings || 0}</div>
                  <div className="text-gray-600 text-sm font-medium">我的預約</div>
                </InfoCard>
                <InfoCard className="text-center transform hover:scale-105 transition-all duration-300">
                  <div className="text-green-600 text-4xl mb-2">{platformStats.totalPartners || 0}</div>
                  <div className="text-gray-600 text-sm font-medium">優質夥伴</div>
                </InfoCard>
                <InfoCard className="text-center transform hover:scale-105 transition-all duration-300">
                  <div className="text-blue-600 text-4xl mb-2">{platformStats.totalBookings || 0}+</div>
                  <div className="text-gray-600 text-sm font-medium">累計服務</div>
                </InfoCard>
                <InfoCard className="text-center transform hover:scale-105 transition-all duration-300">
                  <div className="text-orange-600 text-4xl mb-2">{platformStats.activeUsers || 0}+</div>
                  <div className="text-gray-600 text-sm font-medium">活躍用戶</div>
                </InfoCard>
              </>
            )}
          </div>
        </div>
      )}

      {/* 快捷入口 */}
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">
          快速開始
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => router.push(action.href)}
              className="group text-left transform hover:scale-105 transition-all duration-300"
            >
              <InfoCard className="h-full hover:shadow-2xl">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform duration-300`}>
                  {action.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{action.title}</h3>
                <p className="text-gray-600 text-sm">{action.description}</p>
              </InfoCard>
            </button>
          ))}
        </div>
      </div>

      {/* 服務亮點 */}
      <div className="bg-white py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">
            為什麼選擇 PeiPlay
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-[#6C63FF] flex items-center justify-center text-white">
                <FaBolt className="text-4xl" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">即時預約</h3>
              <p className="text-gray-600 leading-relaxed">
                找到現在有空的夥伴，立即開始遊戲，無需等待
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white">
                <FaShieldAlt className="text-4xl" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">安全保障</h3>
              <p className="text-gray-600 leading-relaxed">
                實名認證、評價系統，確保每次服務都有品質保證
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white">
                <FaHeart className="text-4xl" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">貼心服務</h3>
              <p className="text-gray-600 leading-relaxed">
                24/7 客服支援，專業團隊隨時為您解決問題
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 最新動態 */}
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">
          最新動態
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InfoCard className="hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FaRocket className="text-blue-600 text-xl" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">新功能上線</h3>
                <p className="text-gray-600 text-sm mb-2">
                  群組預約功能正式推出，邀請好友一起玩！
                </p>
                <span className="text-xs text-gray-500">2天前</span>
              </div>
            </div>
          </InfoCard>

          <InfoCard className="hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <FaCrown className="text-green-600 text-xl" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">本月之星</h3>
                <p className="text-gray-600 text-sm mb-2">
                  恭喜 10 位夥伴獲得「五星好評」徽章！
                </p>
                <span className="text-xs text-gray-500">5天前</span>
              </div>
            </div>
          </InfoCard>

          <InfoCard className="hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <FaGift className="text-purple-600 text-xl" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">推薦有獎</h3>
                <p className="text-gray-600 text-sm mb-2">
                  邀請好友註冊，雙方均可獲得優惠券！
                </p>
                <span className="text-xs text-gray-500">1週前</span>
              </div>
            </div>
          </InfoCard>
        </div>
      </div>

      {/* CTA Section */}
      {status !== 'authenticated' && (
        <div className="bg-gradient-to-br from-[#6C63FF] to-[#5a52e6] py-16 sm:py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              準備開始你的遊戲之旅？
            </h2>
            <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              立即註冊，找到最適合你的遊戲夥伴
            </p>
            <button
              onClick={() => router.push('/auth/register')}
              className="bg-white text-[#6C63FF] px-10 py-4 rounded-2xl text-lg font-semibold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              免費註冊
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4">PeiPlay</h3>
              <p className="text-gray-400 text-sm">
                專業的遊戲陪玩平台，讓遊戲更有趣
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">快速連結</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/booking" className="text-gray-400 hover:text-white transition-colors">預約服務</a></li>
                <li><a href="/partners" className="text-gray-400 hover:text-white transition-colors">瀏覽夥伴</a></li>
                <li><a href="/join" className="text-gray-400 hover:text-white transition-colors">成為夥伴</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">幫助中心</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/guidelines" className="text-gray-400 hover:text-white transition-colors">使用指南</a></li>
                <li><a href="/contract" className="text-gray-400 hover:text-white transition-colors">服務條款</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">聯絡我們</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>客服信箱：support@peiplay.com</li>
                <li>服務時間：24/7</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 PeiPlay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
