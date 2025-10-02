'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

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

interface SecurityTask {
  id: string;
  name: string;
  description: string;
  estimatedTime: string;
}

interface SecurityAction {
  id: string;
  name: string;
  description: string;
  requiresReason: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export default function SecurityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [auditData, setAuditData] = useState<SecurityAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableTasks, setAvailableTasks] = useState<SecurityTask[]>([]);
  const [availableActions, setAvailableActions] = useState<SecurityAction[]>([]);
  const [taskLoading, setTaskLoading] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/login');
      return;
    }

    fetchSecurityAudit();
    fetchAvailableTasks();
    fetchAvailableActions();
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

  const fetchAvailableTasks = async () => {
    try {
      const response = await fetch('/api/admin/security-tasks');
      if (response.ok) {
        const data = await response.json();
        setAvailableTasks(data.availableTasks);
      }
    } catch (error) {
      console.error('獲取安全任務失敗:', error);
    }
  };

  const fetchAvailableActions = async () => {
    try {
      const response = await fetch('/api/admin/security-actions');
      if (response.ok) {
        const data = await response.json();
        setAvailableActions(data.availableActions);
      }
    } catch (error) {
      console.error('獲取安全操作失敗:', error);
    }
  };

  const executeSecurityTask = async (taskId: string) => {
    setTaskLoading(taskId);
    try {
      const response = await fetch('/api/admin/security-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: taskId })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`安全任務 "${taskId}" 執行成功`);
        console.log('任務結果:', data.result);
        // 如果是完整檢查，刷新審計數據
        if (taskId === 'full_check') {
          fetchSecurityAudit();
        }
      } else {
        const errorData = await response.json();
        toast.error(`任務執行失敗: ${errorData.error}`);
      }
    } catch (error) {
      console.error('執行安全任務失敗:', error);
      toast.error('執行安全任務失敗');
    } finally {
      setTaskLoading(null);
    }
  };

  const executeSecurityAction = async (actionId: string, targetUserId: string, reason?: string) => {
    setActionLoading(actionId);
    try {
      const response = await fetch('/api/admin/security-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          actionType: actionId, 
          targetUserId,
          reason: reason || '管理員操作'
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`安全操作 "${actionId}" 執行成功`);
        console.log('操作結果:', data.result);
        // 刷新審計數據
        fetchSecurityAudit();
      } else {
        const errorData = await response.json();
        toast.error(`操作執行失敗: ${errorData.error}`);
      }
    } catch (error) {
      console.error('執行安全操作失敗:', error);
      toast.error('執行安全操作失敗');
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

            {/* 安全任務面板 */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">🔧 安全任務</h2>
                <p className="text-sm text-gray-600 mt-1">執行自動化安全檢查和維護任務</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableTasks.map((task) => (
                    <div key={task.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-2">{task.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{task.estimatedTime}</span>
                        <button
                          onClick={() => executeSecurityTask(task.id)}
                          disabled={taskLoading === task.id}
                          className={`px-3 py-1 rounded text-sm ${
                            taskLoading === task.id
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {taskLoading === task.id ? '執行中...' : '執行'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 安全操作面板 */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">⚡ 安全操作</h2>
                <p className="text-sm text-gray-600 mt-1">對用戶執行安全相關操作</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableActions.map((action) => (
                    <div key={action.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{action.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${
                          action.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          action.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          action.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {action.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{action.description}</p>
                      <div className="text-xs text-gray-500">
                        {action.requiresReason ? '需要操作原因' : '無需額外原因'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>注意：</strong>安全操作會直接影響用戶帳號，請謹慎使用。
                    所有操作都會記錄在安全日誌中。
                  </p>
                </div>
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
