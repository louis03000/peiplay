'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import PartnerPageLayout from '@/components/partner/PartnerPageLayout';
import InfoCard from '@/components/partner/InfoCard';
import SectionTitle from '@/components/partner/SectionTitle';

export default function ProfileSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    messageNotifications: true,
    bookingNotifications: true,
    twoFactorEnabled: false,
    loginAlerts: true,
    securityAlerts: true,
  });

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/login');
      return;
    }

    // 載入用戶設定
    loadSettings();
  }, [session, status, router]);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('載入設定失敗:', error);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('設定已儲存！');
      } else {
        throw new Error('儲存失敗');
      }
    } catch (error) {
      console.error('儲存設定失敗:', error);
      toast.error('儲存設定失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6C63FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <PartnerPageLayout
      title="設定"
      subtitle="管理您的帳戶設定和偏好"
      maxWidth="6xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Email 通知設定 */}
        <InfoCard>
          <SectionTitle 
            title="Email 通知設定"
            subtitle="管理您接收的 Email 通知類型"
          />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Email 通知</h3>
                  <p className="text-sm text-gray-700">啟用或停用所有 Email 通知</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#6C63FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6C63FF]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">訊息通知</h3>
                  <p className="text-sm text-gray-700">當您收到新訊息時發送 Email 通知</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.messageNotifications}
                    onChange={(e) => handleSettingChange('messageNotifications', e.target.checked)}
                    className="sr-only peer"
                    disabled={!settings.emailNotifications}
                  />
                  <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 ${!settings.emailNotifications ? 'opacity-50' : ''}`}></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">預約通知</h3>
                  <p className="text-sm text-gray-700">預約相關事件(創建、確認、取消等)的 Email 通知</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.bookingNotifications}
                    onChange={(e) => handleSettingChange('bookingNotifications', e.target.checked)}
                    className="sr-only peer"
                    disabled={!settings.emailNotifications}
                  />
                  <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 ${!settings.emailNotifications ? 'opacity-50' : ''}`}></div>
                </label>
              </div>
            </div>
        </InfoCard>

        {/* 安全設定 */}
        <InfoCard>
          <SectionTitle 
            title="安全設定"
            subtitle="管理您的帳戶安全選項"
          />
          <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">雙重驗證</h3>
                  <p className="text-sm text-gray-700">啟用雙重驗證以提高帳戶安全性</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.twoFactorEnabled}
                    onChange={(e) => handleSettingChange('twoFactorEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#6C63FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6C63FF]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">登入提醒</h3>
                  <p className="text-sm text-gray-700">當有新的登入活動時發送通知</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.loginAlerts}
                    onChange={(e) => handleSettingChange('loginAlerts', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#6C63FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6C63FF]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">安全警報</h3>
                  <p className="text-sm text-gray-700">當偵測到可疑活動時發送通知</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.securityAlerts}
                    onChange={(e) => handleSettingChange('securityAlerts', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#6C63FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6C63FF]"></div>
                </label>
              </div>
            </div>
        </InfoCard>
      </div>

      {/* 儲存按鈕 */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="bg-[#6C63FF] text-white px-6 py-3 rounded-2xl hover:bg-[#5a52e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? '儲存中...' : '儲存設定'}
        </button>
      </div>
    </PartnerPageLayout>
  );
}
