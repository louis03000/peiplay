"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import PartnerPageLayout from '@/components/partner/PartnerPageLayout'
import InfoCard from '@/components/partner/InfoCard'
import SectionTitle from '@/components/partner/SectionTitle'
import StatBox from '@/components/partner/StatBox'

interface ReferralStats {
  partner: {
    id: string;
    name: string;
    inviteCode: string;
    referralCount: number;
    referralEarnings: number;
    totalReferralEarnings: number;
  };
  stats: {
    totalReferrals: number;
    totalEarnings: number;
    currentEarnings: number;
  };
  referrals: Array<{
    id: string;
    inviteeName: string;
    inviteeEmail: string;
    createdAt: string;
    inviteCode: string;
  }>;
  earnings: Array<{
    id: string;
    amount: number;
    percentage: number;
    createdAt: string;
    bookingId: string;
    inviteeName: string;
  }>;
}

export default function ReferralPage() {
  const router = useRouter();
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined, status: "unauthenticated" };
  const session = sessionData.data;
  const status = sessionData.status;
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/");
      return;
    }
    fetchStats();
  }, [session, status, router]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/partners/referral/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        setError('獲取推薦統計失敗');
      }
    } catch (err) {
      setError('獲取推薦統計失敗');
    } finally {
      setLoading(false);
    }
  };

  const generateInviteCode = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/partners/referral/generate-code', {
        method: 'POST'
      });
      if (response.ok) {
        await fetchStats(); // 重新獲取統計
      } else {
        setError('生成邀請碼失敗');
      }
    } catch (err) {
      setError('生成邀請碼失敗');
    } finally {
      setGenerating(false);
    }
  };

  const copyInviteCode = () => {
    if (stats?.partner.inviteCode) {
      navigator.clipboard.writeText(stats.partner.inviteCode);
      alert('邀請碼已複製到剪貼板！');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">載入中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <PartnerPageLayout
      title="推薦系統"
      subtitle="邀請好友成為夥伴，獲得推薦獎勵"
      maxWidth="6xl"
    >
      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatBox
          label="總推薦數"
          value={stats?.stats.totalReferrals || 0}
          iconBgColor="blue"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatBox
          label="累計推薦收入"
          value={`NT$ ${(stats?.stats.totalEarnings || 0).toLocaleString()}`}
          iconBgColor="green"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          }
        />
        <StatBox
          label="可提領推薦收入"
          value={`NT$ ${(stats?.stats.currentEarnings || 0).toLocaleString()}`}
          iconBgColor="purple"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatBox
          label="推薦獎勵比例"
          value={
            stats?.partner?.referralCount !== undefined ? (
              stats.partner.referralCount <= 3 ? '2%' : 
              stats.partner.referralCount <= 10 ? '3%' : '4%'
            ) : '0%'
          }
          iconBgColor="yellow"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
      </div>

      {/* 邀請碼區域 */}
      <InfoCard className="mb-8">
        <SectionTitle title="我的邀請碼" />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {stats?.partner.inviteCode ? (
            <>
              <div className="flex-1">
                <input
                  type="text"
                  value={stats.partner.inviteCode}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-2xl bg-gray-50 text-gray-900 font-mono text-base sm:text-lg"
                />
              </div>
              <button
                onClick={copyInviteCode}
                className="px-6 py-2.5 bg-[#6C63FF] text-white rounded-2xl hover:bg-[#5a52e6] transition-colors font-medium"
              >
                複製邀請碼
              </button>
            </>
          ) : (
            <button
              onClick={generateInviteCode}
              disabled={generating}
              className="px-6 py-2.5 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              {generating ? '生成中...' : '生成邀請碼'}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-4">
          分享您的邀請碼給朋友，當他們使用您的邀請碼申請成為夥伴時，您將根據推薦人數獲得階梯式推薦獎勵！
        </p>
      </InfoCard>

      {/* 推薦說明 */}
      <InfoCard className="mb-8" bgColor="gray">
        <SectionTitle title="推薦系統說明" />
        <ul className="space-y-2 text-gray-700">
          <li>• 使用您的邀請碼申請成為夥伴的朋友，平台抽成依然是 15%，但您將獲得推薦獎勵</li>
          <li>• 推薦獎勵採用階梯式制度，從平台抽成中分配給您：
            <ul className="ml-4 mt-1 space-y-1 text-sm">
              <li>📈 推薦 1-3 人：獲得 2% 推薦獎勵</li>
              <li>📈 推薦 4-10 人：獲得 3% 推薦獎勵</li>
              <li>📈 推薦 10 人以上：獲得 4% 推薦獎勵</li>
            </ul>
          </li>
          <li>• 推薦獎勵會自動計算並加入您的可提領餘額</li>
          <li>• 推薦獎勵無上限，推薦越多，收入越多！</li>
        </ul>
      </InfoCard>

      {/* 推薦列表 */}
      <InfoCard className="overflow-hidden">
        <SectionTitle title="推薦列表" />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    被推薦人
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    邀請碼
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    推薦時間
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats?.referrals.map((referral) => (
                  <tr key={referral.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{referral.inviteeName}</div>
                        <div className="text-sm text-gray-500">{referral.inviteeEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {referral.inviteCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(referral.createdAt).toLocaleString('zh-TW')}
                    </td>
                  </tr>
                ))}
                {(!stats?.referrals || stats.referrals.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                      還沒有推薦記錄
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </InfoCard>
    </PartnerPageLayout>
  );
}

