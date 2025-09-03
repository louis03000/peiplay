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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [suspendingUser, setSuspendingUser] = useState<string | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchUsers();
  }, [session, status, router]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        setError("載入用戶失敗");
      }
    } catch (err) {
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

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("確定要刪除此用戶嗎？此操作無法復原！")) return;

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
        <a
          href="/admin/partners"
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          返回夥伴審核
        </a>
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
              {users.map((user) => (
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
                          收費: {user.partner.halfHourlyRate}金幣/半小時
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
              ))}
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
    </div>
  );
} 