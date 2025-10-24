"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  requestedAt: string;
  processedAt?: string;
  adminNote?: string;
  partner: {
    id: string;
    name: string;
    user: {
      email: string;
    };
  };
}

export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined, status: "unauthenticated" };
  const session = sessionData.data;
  const status = sessionData.status;
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [allWithdrawals, setAllWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchWithdrawals();
  }, [session, status, router]);

  useEffect(() => {
    if (statusFilter === 'ALL') {
      setWithdrawals(allWithdrawals);
    } else {
      setWithdrawals(allWithdrawals.filter(w => w.status === statusFilter));
    }
  }, [statusFilter, allWithdrawals]);

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch('/api/admin/withdrawals');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setAllWithdrawals(data);
          setWithdrawals(data.filter((w: WithdrawalRequest) => w.status === 'PENDING'));
        } else {
          console.error('API returned non-array data:', data);
          setError('數據格式錯誤');
        }
      } else {
        setError('獲取提領申請失敗');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('獲取提領申請失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (withdrawalId: string, newStatus: 'APPROVED' | 'REJECTED' | 'COMPLETED') => {
    setProcessingId(withdrawalId);
    try {
      const response = await fetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          adminNote: adminNote
        }),
      });

      if (response.ok) {
        await fetchWithdrawals();
        setAdminNote("");
        setShowNoteModal(false);
        setSelectedWithdrawal(null);
      } else {
        setError('更新狀態失敗');
      }
    } catch (err) {
      setError('更新狀態失敗');
    } finally {
      setProcessingId(null);
    }
  };

  const openNoteModal = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal);
    setAdminNote(withdrawal.adminNote || "");
    setShowNoteModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">待審核</span>;
      case 'APPROVED':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">已核准</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">已拒絕</span>;
      case 'COMPLETED':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">已完成</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">{status}</span>;
    }
  };

  const getStatusCount = (status: string) => {
    return allWithdrawals.filter(w => w.status === status).length;
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* 頁面標題 */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">提領申請管理</h1>
          <p className="text-blue-200 text-sm sm:text-base">管理夥伴的提領申請</p>
        </div>

        {/* 狀態篩選按鈕 */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
              statusFilter === 'PENDING'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            待審核({getStatusCount('PENDING')})
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
              statusFilter === 'APPROVED'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            已核准({getStatusCount('APPROVED')})
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
              statusFilter === 'REJECTED'
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            已拒絕({getStatusCount('REJECTED')})
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
              statusFilter === 'COMPLETED'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            已完成({getStatusCount('COMPLETED')})
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
              statusFilter === 'ALL'
                ? 'bg-gray-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            全部({allWithdrawals.length})
          </button>
        </div>

        {/* 管理功能按鈕 */}
        <div className="mb-6 flex justify-end gap-2">
          <a
            href="/admin/referral-config"
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            推薦配置管理
          </a>
          <a
            href="/admin/partners"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            夥伴管理
          </a>
          <a
            href="/admin/users"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            用戶管理
          </a>
          <a
            href="/admin/anti-money-laundering"
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            反洗錢監控
          </a>
        </div>

        {/* 提領申請列表 */}
        {withdrawals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-gray-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <p className="text-gray-600 text-lg">
              {statusFilter === 'PENDING' ? '目前沒有待審核的提領申請' : '目前沒有此狀態的提領申請'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      夥伴資訊
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      提領金額
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      狀態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      申請時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      處理時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      管理員備註
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {withdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{withdrawal.partner.name}</div>
                          <div className="text-sm text-gray-700">{withdrawal.partner.user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">NT$ {withdrawal.amount.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(withdrawal.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {new Date(withdrawal.requestedAt).toLocaleString('zh-TW')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {withdrawal.processedAt ? new Date(withdrawal.processedAt).toLocaleString('zh-TW') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {withdrawal.adminNote || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {withdrawal.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openNoteModal(withdrawal)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              備註
                            </button>
                            <button
                              onClick={() => handleStatusChange(withdrawal.id, 'APPROVED')}
                              disabled={processingId === withdrawal.id}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              {processingId === withdrawal.id ? '處理中...' : '核准'}
                            </button>
                            <button
                              onClick={() => handleStatusChange(withdrawal.id, 'REJECTED')}
                              disabled={processingId === withdrawal.id}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              拒絕
                            </button>
                          </div>
                        )}
                        {withdrawal.status === 'APPROVED' && (
                          <button
                            onClick={() => handleStatusChange(withdrawal.id, 'COMPLETED')}
                            disabled={processingId === withdrawal.id}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            {processingId === withdrawal.id ? '處理中...' : '標記完成'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 備註模態框 */}
        {showNoteModal && selectedWithdrawal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">管理員備註</h3>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="請輸入備註..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                  style={{ color: '#111827' }}
                  rows={4}
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setShowNoteModal(false);
                      setSelectedWithdrawal(null);
                      setAdminNote("");
                    }}
                    className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      setShowNoteModal(false);
                      setSelectedWithdrawal(null);
                    }}
                    className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
