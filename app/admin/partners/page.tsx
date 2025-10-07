"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Partner {
  id: string;
  name: string;
  birthday: string;
  phone: string;
  coverImage: string;
  games: string[];
  contractFile: string | null;
  halfHourlyRate: number;
  status: string;
  bankCode: string | null;
  bankAccountNumber: string | null;
  customerMessage: string | null;
  isRankBooster: boolean;
  rankBoosterNote: string | null;
  rankBoosterRank: string | null;
  createdAt: string;
  user: { email: string };
}

export default function AdminPartnersPage() {
  const router = useRouter();
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined, status: "unauthenticated" };
  const session = sessionData.data;
  const status = sessionData.status;
  const [partners, setPartners] = useState<Partner[]>([]);
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetch("/api/admin/partners")
      .then((res) => res.json())
      .then((data) => {
        setAllPartners(data);
        setPartners(data.filter((p: Partner) => p.status === 'PENDING'));
        setLoading(false);
      })
      .catch(() => {
        setError("載入失敗");
        setLoading(false);
      });
  }, [session, status, router]);

  const handleReview = async (id: string, status: "APPROVED" | "REJECTED") => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/partners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      // 更新所有夥伴列表
      setAllPartners((prev) => 
        prev.map((p) => p.id === id ? { ...p, status } : p)
      );
      // 更新當前顯示的夥伴列表
      setPartners((prev) => prev.filter((p) => p.id !== id));
    } else {
      setError("審核失敗");
    }
    setLoading(false);
  };

  // 篩選夥伴
  const filteredPartners = allPartners.filter((p) => {
    if (statusFilter === 'ALL') return true;
    return p.status === statusFilter;
  });

  if (status === "loading" || loading) return <div>載入中...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 pt-32">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">夥伴管理</h1>
        <div className="flex gap-2">
          <a
            href="/admin/withdrawals"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            提領申請管理
          </a>
          <a
            href="/admin/promo-codes"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            優惠碼管理
          </a>
          <a
            href="/admin/users"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            用戶管理
          </a>
          <a
            href="/admin/anti-money-laundering"
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            反洗錢監控
          </a>
        </div>
      </div>
      
      {/* 狀態篩選器 */}
      <div className="mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-4 py-2 rounded transition-colors ${
              statusFilter === 'PENDING' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            待審核 ({allPartners.filter(p => p.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-4 py-2 rounded transition-colors ${
              statusFilter === 'APPROVED' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            已通過 ({allPartners.filter(p => p.status === 'APPROVED').length})
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-4 py-2 rounded transition-colors ${
              statusFilter === 'REJECTED' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            已拒絕 ({allPartners.filter(p => p.status === 'REJECTED').length})
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded transition-colors ${
              statusFilter === 'ALL' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            全部 ({allPartners.length})
          </button>
        </div>
      </div>
      <div className="mb-6 flex justify-end">
        <button
          className="px-6 py-2 rounded bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold shadow hover:scale-105 transition-transform"
          onClick={() => {
            window.open('/api/orders/export?export=excel', '_blank');
          }}
        >
          匯出消費紀錄 Excel
        </button>
      </div>
      {!filteredPartners.length
        ? <div>目前沒有{statusFilter === 'ALL' ? '' : statusFilter === 'PENDING' ? '待審核的' : statusFilter === 'APPROVED' ? '已通過的' : '已拒絕的'}夥伴</div>
        : <div className="space-y-6">
          {filteredPartners.map((p) => (
            <div key={p.id} className="border rounded p-6 bg-white shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* 基本資訊 */}
                  <div className="flex items-center gap-4">
                    <img 
                      src={p.coverImage} 
                      alt={p.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                    />
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{p.name}</h3>
                      <p className="text-sm text-gray-500">申請時間: {new Date(p.createdAt).toLocaleString('zh-TW')}</p>
                    </div>
                  </div>
                  
                  {/* 聯絡資訊 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Email:</span>
                      <span className="ml-2 text-gray-900">{p.user.email}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">電話:</span>
                      <span className="ml-2 text-gray-900">{p.phone}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">生日:</span>
                      <span className="ml-2 text-gray-900">{p.birthday?.slice(0, 10)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">收費:</span>
                      <span className="ml-2 text-gray-900">${p.halfHourlyRate}/半小時</span>
                    </div>
                  </div>
                  
                  {/* 遊戲偏好 */}
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">偏好遊戲:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.games.map((game, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {game}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* 銀行資訊 */}
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">銀行資訊:</span>
                    <div className="mt-1">
                      {p.bankCode ? (
                        <div className="text-gray-900">銀行代碼: {p.bankCode}</div>
                      ) : (
                        <div className="text-red-500">❌ 未填寫銀行代碼</div>
                      )}
                      {p.bankAccountNumber ? (
                        <div className="text-gray-900">帳戶號碼: {p.bankAccountNumber}</div>
                      ) : (
                        <div className="text-red-500">❌ 未填寫帳戶號碼</div>
                      )}
                    </div>
                  </div>
                  
                  {/* 客戶訊息 */}
                  {p.customerMessage && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">客戶訊息:</span>
                      <p className="mt-1 text-gray-900 bg-gray-50 p-2 rounded">{p.customerMessage}</p>
                    </div>
                  )}
                  
                  {/* 排名提升服務 */}
                  {p.isRankBooster && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">排名提升服務:</span>
                      <div className="mt-1">
                        {p.rankBoosterNote && <div>說明: {p.rankBoosterNote}</div>}
                        {p.rankBoosterRank && <div>專精排名: {p.rankBoosterRank}</div>}
                      </div>
                    </div>
                  )}
                  
                  {/* 合約書 */}
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">合約書:</span>
                    <div className="mt-1">
                      {p.contractFile ? (
                        <a 
                          href={p.contractFile} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          📄 查看合約書
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-2 bg-red-100 text-red-800 rounded-lg">
                          ❌ 未上傳
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* 審核按鈕區域 */}
                <div className="flex flex-col gap-3 lg:min-w-[200px]">
                  <div className={`px-4 py-2 rounded-lg text-sm font-medium text-center ${
                    p.status === 'APPROVED' ? 'bg-green-100 text-green-800 border border-green-200' :
                    p.status === 'REJECTED' ? 'bg-red-100 text-red-800 border border-red-200' :
                    'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  }`}>
                    {p.status === 'APPROVED' ? '✅ 已通過' :
                     p.status === 'REJECTED' ? '❌ 已拒絕' : '⏳ 待審核'}
                  </div>
                  
                  {p.status === 'PENDING' && (
                    <div className="flex flex-col gap-2">
                      <button
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        onClick={() => handleReview(p.id, "APPROVED")}
                      >
                        ✅ 通過申請
                      </button>
                      <button
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                        onClick={() => handleReview(p.id, "REJECTED")}
                      >
                        ❌ 拒絕申請
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
} 