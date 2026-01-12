"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspensionEndsAt: string | null;
  createdAt: string;
  partner?: {
    id: string;
    status: string;
    games: string[];
    halfHourlyRate: number;
    contractFile: string | null;
  };
  customer?: {
    id: string;
  };
}

export default function AdminUsersPage() {
  const router = useRouter();
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined, status: "unauthenticated" };
  const session = sessionData.data;
  const status = sessionData.status;
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [suspendingUser, setSuspendingUser] = useState<string | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<{ userId: string; step: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [resettingDatabase, setResettingDatabase] = useState(false);
  const [resetConfirmStep, setResetConfirmStep] = useState(0);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchUsers();
  }, [session, status, router]);

  // 搜尋和篩選功能
  useEffect(() => {
    let filtered = users;

    // 角色篩選
    if (roleFilter !== "ALL") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // 搜尋功能
    if (searchTerm.trim()) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.partner && user.partner.games.some(game => 
          game.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
    }

    setFilteredUsers(filtered);
  }, [searchTerm, roleFilter, users]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsers(data);
          setFilteredUsers(data);
        } else {
          console.error('API returned non-array data:', data);
          setError('數據格式錯誤');
        }
      } else {
        setError("載入用戶失敗");
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError("載入用戶失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    if (!suspensionReason.trim()) {
      alert("請輸入停權原因");
      return;
    }

    setSuspendingUser(userId);
    try {
      const res = await fetch("/api/admin/users/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          reason: suspensionReason,
          days: 7
        }),
      });

      if (res.ok) {
        await fetchUsers();
        setSuspensionReason("");
        setSuspendingUser(null);
      } else {
        const error = await res.json();
        alert(error.error || "停權失敗");
      }
    } catch (err) {
      alert("停權失敗");
    } finally {
      setSuspendingUser(null);
    }
  };

  const handleUnsuspendUser = async (userId: string) => {
    if (!confirm("確定要解除停權嗎？")) return;

    try {
      const res = await fetch("/api/admin/users/unsuspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        await fetchUsers();
      } else {
        const error = await res.json();
        alert(error.error || "解除停權失敗");
      }
    } catch (err) {
      alert("解除停權失敗");
    }
  };

  const handleDeleteUser = (userId: string) => {
    // 開始第一次確認
    setDeleteConfirmStep({ userId, step: 1 });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmStep) return;

    const { userId, step } = deleteConfirmStep;

    // 如果還沒到第三次確認，繼續下一步
    if (step < 3) {
      setDeleteConfirmStep({ userId, step: step + 1 });
      return;
    }

    // 第三次確認後，執行刪除
    setDeleteConfirmStep(null);
    setDeletingUser(userId);
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        await fetchUsers();
      } else {
        const error = await res.json();
        alert(error.error || "刪除用戶失敗");
      }
    } catch (err) {
      alert("刪除用戶失敗");
    } finally {
      setDeletingUser(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmStep(null);
  };

  const handleResetDatabase = async () => {
    // 確認步驟 1: 第一次確認
    if (resetConfirmStep === 0) {
      if (!confirm('⚠️ 警告：此操作將完全清除所有用戶資料（除了管理員）\n\n確定要繼續嗎？')) {
        return;
      }
      setResetConfirmStep(1);
      return;
    }

    // 確認步驟 2: 第二次確認
    if (resetConfirmStep === 1) {
      if (!confirm('⚠️ 第二次確認\n\n這將刪除所有用戶、夥伴、訂單、提領記錄等資料\n\n確定要執行資料庫重置嗎？')) {
        setResetConfirmStep(0);
        return;
      }
      setResetConfirmStep(2);
      return;
    }

    // 確認步驟 3: 最終確認
    if (resetConfirmStep === 2) {
      const finalConfirm = prompt('⚠️ 最終確認\n\n請輸入 "RESET" 以確認資料庫重置：');
      if (finalConfirm !== 'RESET') {
        alert('輸入不正確，操作已取消');
        setResetConfirmStep(0);
        return;
      }

      try {
        setResettingDatabase(true);
        const res = await fetch('/api/admin/reset-database', {
          method: 'POST',
        });

        const data = await res.json();

        if (res.ok) {
          alert('✅ 資料庫重置完成！\n\n所有非管理員用戶資料已清除。');
          setResetConfirmStep(0);
          // 重新載入用戶列表
          await fetchUsers();
        } else {
          alert(`❌ 重置失敗：${data.error || '未知錯誤'}`);
          setResetConfirmStep(0);
        }
      } catch (err) {
        console.error('Reset database error:', err);
        alert('重置失敗，請稍後再試');
        setResetConfirmStep(0);
      } finally {
        setResettingDatabase(false);
      }
    }
  };

  const handleResetCancel = () => {
    setResetConfirmStep(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-TW");
  };

  const getSuspensionStatus = (user: User) => {
    if (!user.isSuspended) return null;
    
    const now = new Date();
    const endsAt = user.suspensionEndsAt ? new Date(user.suspensionEndsAt) : null;
    
    if (endsAt && endsAt > now) {
      const remaining = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return `停權中 (剩餘 ${remaining} 天)`;
    } else {
      return "停權已過期";
    }
  };

  if (status === "loading" || loading) return <div className="pt-32 text-center">載入中...</div>;
  if (error) return <div className="pt-32 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto py-8 pt-32 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">用戶管理</h1>
        <div className="flex gap-2">
          <a
            href="/admin/withdrawals"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            提領申請管理
          </a>
          <a
            href="/admin/partners"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            返回夥伴審核
          </a>
        </div>
      </div>

      {/* 資料庫重置功能（僅測試環境） */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-800 mb-2">
                ⚠️ 資料庫重置（僅測試環境）
              </h3>
              <p className="text-sm text-red-700 mb-4">
                此功能將完全清除所有用戶資料（除了管理員），包括：用戶、夥伴、訂單、提領記錄等。
                <br />
                <strong>此操作無法復原，請謹慎使用！</strong>
              </p>
              {resetConfirmStep === 0 && (
                <button
                  onClick={handleResetDatabase}
                  disabled={resettingDatabase}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {resettingDatabase ? '重置中...' : '重置資料庫'}
                </button>
              )}
              {resetConfirmStep > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-800">
                    確認步驟 {resetConfirmStep} / 3
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleResetDatabase}
                      disabled={resettingDatabase}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {resetConfirmStep === 3 ? (resettingDatabase ? '重置中...' : '確認重置') : '繼續'}
                    </button>
                    <button
                      onClick={handleResetCancel}
                      disabled={resettingDatabase}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 搜尋框 */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="搜尋用戶名字、Email 或遊戲類型..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 pr-4 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        {/* 角色篩選按鈕 */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setRoleFilter("ALL")}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              roleFilter === "ALL" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setRoleFilter("CUSTOMER")}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              roleFilter === "CUSTOMER" 
                ? "bg-green-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            顧客
          </button>
          <button
            onClick={() => setRoleFilter("PARTNER")}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              roleFilter === "PARTNER" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            夥伴
          </button>
          <button
            onClick={() => setRoleFilter("ADMIN")}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              roleFilter === "ADMIN" 
                ? "bg-red-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            管理員
          </button>
        </div>

        {(searchTerm || roleFilter !== "ALL") && (
          <div className="mt-2 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              找到 {filteredUsers.length} 個用戶
            </div>
            <button
              onClick={() => {
                setSearchTerm("");
                setRoleFilter("ALL");
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              清空篩選
            </button>
          </div>
        )}
      </div>
      
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用戶資訊
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  角色
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  夥伴資訊
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  停權狀態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  註冊時間
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? `沒有找到包含 "${searchTerm}" 的用戶` : "沒有用戶資料"}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name || "未設定"}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === "ADMIN" ? "bg-red-100 text-red-800" :
                      user.role === "PARTNER" ? "bg-blue-100 text-blue-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      {user.role === "ADMIN" ? "管理員" :
                       user.role === "PARTNER" ? "夥伴" : "顧客"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.partner ? (
                      <div>
                        <div className="text-sm text-gray-900">
                          狀態: <span className={`${
                            user.partner.status === "APPROVED" ? "text-green-600" :
                            user.partner.status === "PENDING" ? "text-yellow-600" :
                            "text-red-600"
                          }`}>
                            {user.partner.status === "APPROVED" ? "已通過" :
                             user.partner.status === "PENDING" ? "待審核" : "已拒絕"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          遊戲: {user.partner.games.join(", ")}
                        </div>
                        <div className="text-sm text-gray-500">
                          收費: ${user.partner.halfHourlyRate}/半小時
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">非夥伴</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isSuspended ? (
                      <div>
                        <div className="text-sm text-red-600 font-medium">
                          {getSuspensionStatus(user)}
                        </div>
                        {user.suspensionReason && (
                          <div className="text-xs text-gray-500 mt-1">
                            原因: {user.suspensionReason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-green-600">正常</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col gap-2">
                      {/* 契約書查看按鈕 - 只有夥伴才顯示 */}
                      {user.partner && user.partner.contractFile && (
                        <button
                          onClick={() => {
                            // 在新窗口中打開契約書
                            window.open(user.partner!.contractFile!, '_blank');
                          }}
                          className="text-blue-600 hover:text-blue-900 text-xs flex items-center gap-1"
                          title="在新窗口中查看契約書"
                        >
                          📄 查看契約書
                        </button>
                      )}
                      {user.isSuspended ? (
                        <button
                          onClick={() => handleUnsuspendUser(user.id)}
                          className="text-green-600 hover:text-green-900 text-xs"
                        >
                          解除停權
                        </button>
                      ) : (
                        <button
                          onClick={() => setSuspendingUser(user.id)}
                          className="text-yellow-600 hover:text-yellow-900 text-xs"
                        >
                          停權 7 天
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={deletingUser === user.id}
                        className="text-red-600 hover:text-red-900 text-xs disabled:opacity-50"
                      >
                        {deletingUser === user.id ? "刪除中..." : "刪除帳號"}
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 停權對話框 */}
      {suspendingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">停權用戶</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                停權原因
              </label>
              <textarea
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="請輸入停權原因..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSuspendingUser(null);
                  setSuspensionReason("");
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={() => handleSuspendUser(suspendingUser)}
                disabled={suspendingUser === null}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                確認停權
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除帳號三次確認對話框 */}
      {deleteConfirmStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="mb-4">
              <div className="flex items-center justify-center mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                  deleteConfirmStep.step === 1 ? 'bg-red-500' :
                  deleteConfirmStep.step === 2 ? 'bg-orange-500' :
                  'bg-red-600'
                }`}>
                  {deleteConfirmStep.step}
                </div>
              </div>
              <h3 className="text-xl font-bold text-red-600 text-center mb-2">
                第 {deleteConfirmStep.step} 次確認
              </h3>
              <p className="text-gray-700 text-center mb-4">
                確定要刪除此用戶嗎？此操作無法復原！
              </p>
              <p className="text-sm text-gray-500 text-center">
                {deleteConfirmStep.step < 3 && `還需要 ${3 - deleteConfirmStep.step} 次確認才能刪除`}
                {deleteConfirmStep.step === 3 && "最後一次確認，點擊後將立即刪除"}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className={`px-4 py-2 text-white rounded hover:opacity-90 ${
                  deleteConfirmStep.step === 1 ? 'bg-red-500 hover:bg-red-600' :
                  deleteConfirmStep.step === 2 ? 'bg-orange-500 hover:bg-orange-600' :
                  'bg-red-600 hover:bg-red-700'
                }`}
              >
                {deleteConfirmStep.step < 3 ? '繼續確認' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 