'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: string;
  createdAt: string;
}

export default function VerifyUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/login');
      return;
    }

    fetchUsers();
  }, [session, status, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('獲取用戶列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyUser = async (userId: string) => {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/admin/verify-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        // 更新本地狀態
        setUsers(users.map(user => 
          user.id === userId 
            ? { ...user, emailVerified: true }
            : user
        ));
        alert('用戶 Email 驗證成功！');
      } else {
        const error = await response.json();
        alert(`驗證失敗: ${error.error}`);
      }
    } catch (error) {
      console.error('驗證用戶失敗:', error);
      alert('驗證失敗，請稍後再試');
    } finally {
      setActionLoading(null);
    }
  };

  const unverifyUser = async (userId: string) => {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/admin/unverify-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        // 更新本地狀態
        setUsers(users.map(user => 
          user.id === userId 
            ? { ...user, emailVerified: false }
            : user
        ));
        alert('用戶 Email 驗證已撤銷！');
      } else {
        const error = await response.json();
        alert(`撤銷失敗: ${error.error}`);
      }
    } catch (error) {
      console.error('撤銷驗證失敗:', error);
      alert('撤銷失敗，請稍後再試');
    } finally {
      setActionLoading(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">載入中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  const unverifiedUsers = users.filter(user => !user.emailVerified);
  const verifiedUsers = users.filter(user => user.emailVerified);

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">用戶 Email 驗證管理</h1>
          <p className="mt-2 text-gray-600">管理用戶的 Email 驗證狀態</p>
        </div>

        {/* 未驗證用戶 */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              未驗證用戶 ({unverifiedUsers.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用戶資訊
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
                {unverifiedUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="text-xs text-gray-400">角色: {user.role}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => verifyUser(user.id)}
                        disabled={actionLoading === user.id}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === user.id ? '處理中...' : '手動驗證'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {unverifiedUsers.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">
                沒有未驗證的用戶
              </div>
            )}
          </div>
        </div>

        {/* 已驗證用戶 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              已驗證用戶 ({verifiedUsers.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用戶資訊
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
                {verifiedUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="text-xs text-gray-400">角色: {user.role}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => unverifyUser(user.id)}
                        disabled={actionLoading === user.id}
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === user.id ? '處理中...' : '撤銷驗證'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {verifiedUsers.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">
                沒有已驗證的用戶
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
