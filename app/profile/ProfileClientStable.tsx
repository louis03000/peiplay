'use client'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'

export default function ProfileClientStable() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    birthday: '',
    discord: '',
    customerMessage: '',
    games: [] as string[],
    halfHourlyRate: undefined as number | undefined
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // 載入用戶資料
  useEffect(() => {
    if (!session || !mounted) return;

    const loadUserData = async () => {
      try {
        const res = await fetch('/api/user/profile');
        const data = await res.json();
        if (res.ok && data.user) {
          setUserData(data.user);
          setFormData({
            name: data.user.name || '',
            phone: data.user.phone || '',
            birthday: data.user.birthday ? data.user.birthday.slice(0, 10) : '',
            discord: data.user.discord || '',
            customerMessage: data.user.partner?.customerMessage || '',
            games: data.user.partner?.games || [],
            halfHourlyRate: data.user.partner?.halfHourlyRate,
          });
        }
      } catch (error) {
        console.error('載入用戶資料失敗:', error);
      }
    };

    loadUserData();
  }, [session, mounted]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (res.ok) {
        setSuccess('資料已更新！');
        setEditMode(false);
        // 重新載入用戶資料
        const refreshRes = await fetch('/api/user/profile');
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.user) {
          setUserData(refreshData.user);
        }
      } else {
        setError(data.error || '更新失敗');
      }
    } catch (err) {
      setError('更新失敗');
    } finally {
      setLoading(false);
    }
  };

  // 如果還在載入或未掛載，顯示載入狀態
  if (status === 'loading' || !mounted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">載入中...</div>
        </div>
      </div>
    );
  }

  // 如果沒有用戶資料，顯示載入狀態
  if (!userData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">載入用戶資料中...</div>
        </div>
      </div>
    );
  }

  const isPartner = !!userData.partner;

  return (
    <div className="container mx-auto px-4 py-8 pt-32">
      {/* 頁面標題 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">會員中心</h1>
        <p className="text-gray-300">
          {isPartner 
            ? '管理您的個人資料、預約服務和客戶訂單' 
            : '管理您的個人資料、預約記錄和消費紀錄'
          }
        </p>
      </div>

      {/* 個人資料區塊 */}
      <div className="max-w-4xl mx-auto mb-12">
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center">
            <span className="mr-2">👤</span>
            個人資料
          </h2>
          <p className="text-gray-300 text-sm mb-4">
            管理您的個人基本資料，這些資訊會用於服務聯繫和身份驗證
          </p>
          
          {!editMode ? (
            <div className="bg-gray-800/60 p-6 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="block text-gray-300 mb-1">姓名</span>
                  <span className="text-white font-medium">{userData.name}</span>
                </div>
                <div>
                  <span className="block text-gray-300 mb-1">電話</span>
                  <span className="text-white font-medium">{userData.phone || '-'}</span>
                </div>
                <div>
                  <span className="block text-gray-300 mb-1">生日</span>
                  <span className="text-white font-medium">{userData.birthday ? userData.birthday.slice(0, 10) : '-'}</span>
                </div>
                <div>
                  <span className="block text-gray-300 mb-1">Discord 名稱</span>
                  <span className="text-white font-medium">{userData.discord || '-'}</span>
                </div>
              </div>
              
              {isPartner && userData.partner?.halfHourlyRate && (
                <div className="mt-6">
                  <div className="text-gray-300 mb-1 font-semibold">每半小時收費</div>
                  <span className="text-white font-medium">{`$${userData.partner.halfHourlyRate}`}</span>
                </div>
              )}
              
              {isPartner && (
                <div className="mt-6">
                  <div className="text-gray-300 mb-1 font-semibold">留言板（顧客預約時會看到）</div>
                  <div className="bg-gray-900/80 rounded p-3 text-white min-h-[40px] border border-gray-700 text-sm">
                    {userData.partner?.customerMessage ? userData.partner.customerMessage : <span className="text-gray-500">（尚未填寫留言）</span>}
                  </div>
                </div>
              )}
              
              <button 
                className="w-full py-3 rounded-lg bg-indigo-500 text-white font-bold text-lg mt-6 hover:bg-indigo-600 transition" 
                onClick={() => setEditMode(true)}
              >
                修改個人資料
              </button>
            </div>
          ) : (
            <form className="bg-gray-800/60 p-6 rounded-lg" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1">姓名</label>
                  <input 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">電話</label>
                  <input 
                    name="phone" 
                    value={formData.phone} 
                    onChange={handleInputChange} 
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">生日</label>
                  <input 
                    name="birthday" 
                    type="date" 
                    value={formData.birthday} 
                    onChange={handleInputChange} 
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Discord 名稱</label>
                  <input 
                    name="discord" 
                    value={formData.discord} 
                    onChange={handleInputChange} 
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none" 
                  />
                </div>
              </div>
              
              {isPartner && (
                <div className="mt-6">
                  <label className="block text-gray-300 mb-1">每半小時收費</label>
                  <input
                    name="halfHourlyRate"
                    type="number"
                    value={formData.halfHourlyRate ?? ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none"
                    required
                    min={1}
                  />
                </div>
              )}
              
              {isPartner && (
                <div className="mt-6">
                  <label className="block text-gray-300 mb-1 font-semibold">留言板（顧客預約時會看到，限 500 字，含空格）</label>
                  <textarea
                    name="customerMessage"
                    value={formData.customerMessage}
                    onChange={e => {
                      if (e.target.value.length <= 500) handleInputChange(e)
                    }}
                    maxLength={500}
                    className="w-full rounded bg-gray-900 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none p-3 min-h-[40px] text-sm"
                    placeholder="請輸入想對顧客說的話...（限 500 字，含空格）"
                  />
                  <div className="text-right text-xs text-gray-400 mt-1">{formData.customerMessage.length}/500</div>
                </div>
              )}
              
              {success && <div className="text-green-400 mb-4 text-center">{success}</div>}
              {error && <div className="text-red-400 mb-4 text-center">{error}</div>}
              
              <div className="flex gap-3 mt-6">
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-bold transition" 
                  disabled={loading}
                >
                  {loading ? '儲存中...' : '儲存變更'}
                </button>
                <button 
                  type="button" 
                  className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 rounded text-white font-bold transition" 
                  onClick={() => setEditMode(false)}
                >
                  取消
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
} 