'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface SecurityAudit {
  userSecurity: {
    totalUsers: number;
    verifiedUsers: number;
    unverifiedUsers: number;
    adminUsers: number;
    verificationRate: string;
  };
  passwordSecurity: {
    weakPasswordCount: number;
    weakPasswordUsers: string[];
  };
  emailSecurity: {
    duplicateEmailCount: number;
    duplicateEmails: string[];
  };
  systemSecurity: {
    recentLoginCount: number;
    oldUnverifiedUsersCount: number;
    oldUnverifiedUsers: Array<{
      email: string;
      createdAt: string;
    }>;
  };
  recommendations: string[];
}

export default function SecurityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [auditData, setAuditData] = useState<SecurityAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/login');
      return;
    }

    fetchSecurityAudit();
  }, [session, status, router]);

  const fetchSecurityAudit = async () => {
    try {
      const response = await fetch('/api/admin/security-audit');
      if (response.ok) {
        const data = await response.json();
        setAuditData(data.auditResults);
      } else {
        setError('獲取安全審計數據失敗');
      }
    } catch (error) {
      console.error('安全審計失敗:', error);
      setError('安全審計失敗');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">載入安全審計中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800">錯誤</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchSecurityAudit}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              重新載入
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🔒 安全監控中心</h1>
          <p className="mt-2 text-gray-600">系統安全狀態和審計報告</p>
        </div>

        {auditData && (
          <div className="space-y-6">
            {/* 用戶安全概覽 */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">👥 用戶安全概覽</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{auditData.userSecurity.totalUsers}</div>
                    <div className="text-sm text-gray-500">總用戶數</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{auditData.userSecurity.verifiedUsers}</div>
                    <div className="text-sm text-gray-500">已驗證用戶</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">{auditData.userSecurity.unverifiedUsers}</div>
                    <div className="text-sm text-gray-500">未驗證用戶</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">{auditData.userSecurity.adminUsers}</div>
                    <div className="text-sm text-gray-500">管理員</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Email 驗證率</span>
                    <span>{auditData.userSecurity.verificationRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${auditData.userSecurity.verificationRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 密碼安全 */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">🔐 密碼安全</h2>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-lg">弱密碼用戶</span>
                  <span className={`text-2xl font-bold ${auditData.passwordSecurity.weakPasswordCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {auditData.passwordSecurity.weakPasswordCount}
                  </span>
                </div>
                {auditData.passwordSecurity.weakPasswordUsers.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">弱密碼用戶列表：</p>
                    <ul className="list-disc list-inside text-sm text-red-600">
                      {auditData.passwordSecurity.weakPasswordUsers.map((email, index) => (
                        <li key={index}>{email}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* 系統安全 */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">🛡️ 系統安全</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">最近活動</h3>
                    <div className="text-2xl font-bold text-blue-600">{auditData.systemSecurity.recentLoginCount}</div>
                    <div className="text-sm text-gray-500">24小時內登入次數</div>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">長期未驗證用戶</h3>
                    <div className="text-2xl font-bold text-yellow-600">{auditData.systemSecurity.oldUnverifiedUsersCount}</div>
                    <div className="text-sm text-gray-500">7天前創建但未驗證</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 安全建議 */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">💡 安全建議</h2>
              </div>
              <div className="p-6">
                {auditData.recommendations.length > 0 ? (
                  <ul className="space-y-2">
                    {auditData.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-yellow-500 mr-2">⚠️</span>
                        <span className="text-gray-700">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-green-600">✅ 系統安全狀態良好，無需特別關注的問題</p>
                )}
              </div>
            </div>

            {/* 刷新按鈕 */}
            <div className="text-center">
              <button
                onClick={fetchSecurityAudit}
                className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700"
              >
                🔄 刷新審計報告
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
