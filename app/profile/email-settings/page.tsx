'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface EmailSettings {
  emailNotifications: boolean;
  messageNotifications: boolean;
  bookingNotifications: boolean;
  systemNotifications: boolean;
}

export default function EmailSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<EmailSettings>({
    emailNotifications: true,
    messageNotifications: true,
    bookingNotifications: true,
    systemNotifications: true,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    
    if (status === 'authenticated') {
      loadSettings();
    }
  }, [status, router]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // 這裡可以從 API 獲取用戶的 Email 設定
      // 暫時使用預設值
    } catch (error) {
      console.error('載入設定失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // 這裡可以保存設定到 API
      // 暫時只顯示成功訊息
      alert('設定已保存！');
    } catch (error) {
      console.error('保存設定失敗:', error);
      alert('保存設定失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (key: keyof EmailSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 標題 */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 返回
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Email 通知設定</h1>
          </div>
          <p className="mt-2 text-gray-600">管理您接收的 Email 通知類型</p>
        </div>

        {/* 設定表單 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="space-y-6">
              {/* 總開關 */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Email 通知</h3>
                    <p className="text-sm text-gray-500">啟用或停用所有 Email 通知</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.emailNotifications}
                      onChange={() => handleInputChange('emailNotifications')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>

              {/* 訊息通知 */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">訊息通知</h3>
                  <p className="text-sm text-gray-500">當您收到新訊息時發送 Email 通知</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.messageNotifications && settings.emailNotifications}
                    onChange={() => handleInputChange('messageNotifications')}
                    disabled={!settings.emailNotifications}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* 預約通知 */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">預約通知</h3>
                  <p className="text-sm text-gray-500">預約相關事件（創建、確認、取消等）的 Email 通知</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.bookingNotifications && settings.emailNotifications}
                    onChange={() => handleInputChange('bookingNotifications')}
                    disabled={!settings.emailNotifications}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* 系統通知 */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">系統通知</h3>
                  <p className="text-sm text-gray-500">系統公告、維護通知等重要訊息</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.systemNotifications && settings.emailNotifications}
                    onChange={() => handleInputChange('systemNotifications')}
                    disabled={!settings.emailNotifications}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-disabled:opacity-50"></div>
                </label>
              </div>
            </div>

            {/* 儲存按鈕 */}
            <div className="mt-8 flex justify-end space-x-4">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '保存設定'}
              </button>
            </div>
          </div>
        </div>

        {/* 說明區域 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">📧 Email 通知說明</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>• <strong>訊息通知</strong>：當其他用戶發送訊息給您時，會收到 Email 通知</p>
            <p>• <strong>預約通知</strong>：預約創建、確認、取消、提醒等事件的通知</p>
            <p>• <strong>系統通知</strong>：重要的系統公告和維護通知</p>
            <p>• 您可以隨時調整這些設定，變更會立即生效</p>
            <p>• 即使停用 Email 通知，您仍可在系統內的信箱查看所有訊息</p>
          </div>
        </div>
      </div>
    </div>
  );
}
