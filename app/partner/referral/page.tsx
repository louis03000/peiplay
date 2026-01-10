"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/");
      return;
    }
    fetchStats();
    
    // ✅ 添加自動刷新機制：每 30 秒自動更新推薦收入（靜默模式，不顯示 loading）
    const intervalId = setInterval(() => {
      fetchStats(true); // 靜默刷新，不顯示 loading 狀態
    }, 30000); // 30 秒刷新一次
    
    // 清理定時器
    return () => {
      clearInterval(intervalId);
    };
  }, [session, status, router]);

  const fetchStats = async (silent: boolean = false) => {
    // 如果正在刷新且不是靜默模式，跳過
    if (isRefreshing && !silent) return;
    
    try {
      if (!silent) {
        setIsRefreshing(true);
      }
      
      const response = await fetch('/api/partners/referral/stats', {
        cache: 'no-store', // 確保獲取最新數據
      });
      const data = await response.json();
      console.log('[推薦系統] 獲取統計響應:', { status: response.status, ok: response.ok });
      
      if (response.ok) {
        setStats(data);
        setError(''); // 清除錯誤
      } else {
        const errorMessage = data.error || '獲取推薦統計失敗';
        console.error('[推薦系統] 獲取統計失敗:', errorMessage);
        if (!silent) {
          setError(errorMessage);
        }
      }
    } catch (err) {
      console.error('[推薦系統] 獲取統計異常:', err);
      if (!silent) {
        setError(err instanceof Error ? err.message : '獲取推薦統計失敗');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const generateInviteCode = async () => {
    setGenerating(true);
    setError(''); // 清除之前的錯誤
    try {
      const response = await fetch('/api/partners/referral/generate-code', {
        method: 'POST'
      });
      
      const data = await response.json();
      console.log('[推薦系統] 生成邀請碼響應:', { status: response.status, ok: response.ok, data });
      
      if (response.ok) {
        await fetchStats(); // 重新獲取統計
      } else {
        const errorMessage = data.error || data.message || '生成邀請碼失敗';
        console.error('[推薦系統] 生成邀請碼失敗:', errorMessage);
        setError(errorMessage);
      }
    } catch (err) {
      console.error('[推薦系統] 生成邀請碼異常:', err);
      setError(err instanceof Error ? err.message : '生成邀請碼失敗');
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

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            重試
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 頁面標題 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">推薦系統</h1>
            <p className="text-gray-600">邀請好友成為夥伴，獲得推薦獎勵</p>
          </div>
          <button
            onClick={() => fetchStats(false)}
            disabled={isRefreshing || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? '更新中...' : '手動更新'}
          </button>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-700">總推薦數</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.stats.totalReferrals || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-700">累計推薦收入</p>
                <p className="text-2xl font-bold text-gray-900">NT$ {Math.floor(stats?.stats.totalEarnings || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">可提領推薦收入</p>
                <p className="text-2xl font-bold text-gray-900">NT$ {Math.floor(stats?.stats.currentEarnings || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">推薦獎勵比例</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.partner?.referralCount !== undefined ? (
                    stats.partner.referralCount >= 1 && stats.partner.referralCount <= 3 ? '2%' : 
                    stats.partner.referralCount >= 4 && stats.partner.referralCount <= 10 ? '3%' : 
                    stats.partner.referralCount > 10 ? '4%' : '0%'
                  ) : '0%'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 錯誤提示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* 邀請碼區域 */}
        <div className="bg-gray-50 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">我的邀請碼</h2>
          <div className="flex items-center space-x-4">
            {stats?.partner.inviteCode ? (
              <>
                <div className="flex-1">
                  <input
                    type="text"
                    value={stats.partner.inviteCode}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 font-mono text-lg"
                  />
                </div>
                <button
                  onClick={copyInviteCode}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  複製邀請碼
                </button>
              </>
            ) : (
              <button
                onClick={generateInviteCode}
                disabled={generating}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {generating ? '生成中...' : '生成邀請碼'}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            分享您的邀請碼給朋友，當他們使用您的邀請碼申請成為夥伴時，您將根據推薦人數獲得階梯式推薦獎勵！
          </p>
        </div>

        {/* 推薦說明 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">推薦系統說明</h3>
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
        </div>

        {/* 推薦列表 */}
        <div className="bg-gray-50 rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">推薦列表</h2>
          </div>
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
        </div>
      </div>
    </div>
  );
}

