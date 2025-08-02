'use client'
import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import MyBookings from '@/app/components/MyBookings'
import OrderHistory from '@/app/components/OrderHistory'

const ALL_GAMES = [
  'LOL', 'APEX', '傳說對決', 'PUBG', 'CS:GO', 'VALORANT', '爐石戰記', 'DOTA2', '其他'
];

const MAX_GAMES = 10;

export default function ProfileClientComplete() {
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
  const [customGame, setCustomGame] = useState('');
  
  // 註銷帳號相關狀態
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 載入用戶資料
  useEffect(() => {
    if (!session || !mounted) return;

    const loadUserData = async () => {
      try {
        const res = await fetch('/api/user/profile');
        if (res.status === 401) {
          await signOut({ callbackUrl: '/' });
          return;
        }
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

  const handleGameChange = (game: string) => {
    if (formData.games.includes(game)) {
      setFormData(prev => ({ ...prev, games: prev.games.filter(g => g !== game) }));
    } else if (formData.games.length < MAX_GAMES) {
      setFormData(prev => ({ ...prev, games: [...prev.games, game] }));
    }
  };

  const handleAddCustomGame = () => {
    const trimmed = customGame.trim();
    if (trimmed && !formData.games.includes(trimmed) && trimmed.length <= 50 && formData.games.length < MAX_GAMES) {
      setFormData(prev => ({ ...prev, games: [...prev.games, trimmed] }));
      setCustomGame('');
    }
  };

  const handleRemoveGame = (game: string) => {
    setFormData(prev => ({ ...prev, games: prev.games.filter(g => g !== game) }));
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

  // 處理註銷帳號
  const handleDeleteAccount = async () => {
    if (confirmationCode !== 'delect_account') {
      setError('確認碼錯誤');
      return;
    }

    setDeleteLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/user/delete-account-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationCode })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // 註銷成功，登出用戶
        window.location.href = '/';
      } else {
        setError(data.error || '註銷失敗');
      }
    } catch (err) {
      setError('註銷失敗');
    } finally {
      setDeleteLoading(false);
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
    <div className="container mx-auto px-4 py-8 pt-20">
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
      <div className="max-w-6xl mx-auto mb-12">
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-8 mb-6">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center">
            <span className="mr-2">👤</span>
            個人資料
          </h2>
          <p className="text-gray-300 text-sm mb-4">
            管理您的個人基本資料，這些資訊會用於服務聯繫和身份驗證
          </p>
          
          {!editMode ? (
            <div className="bg-gray-800/60 p-8 rounded-lg">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-700/40 rounded-lg">
                  <span className="block text-gray-300 mb-2 text-sm font-medium">姓名</span>
                  <span className="text-white font-semibold text-lg">{userData.name}</span>
                </div>
                <div className="p-4 bg-gray-700/40 rounded-lg">
                  <span className="block text-gray-300 mb-2 text-sm font-medium">電話</span>
                  <span className="text-white font-semibold text-lg">{userData.phone || '-'}</span>
                </div>
                <div className="p-4 bg-gray-700/40 rounded-lg">
                  <span className="block text-gray-300 mb-2 text-sm font-medium">生日</span>
                  <span className="text-white font-semibold text-lg">{userData.birthday ? userData.birthday.slice(0, 10) : '-'}</span>
                </div>
                <div className="p-4 bg-gray-700/40 rounded-lg">
                  <span className="block text-gray-300 mb-2 text-sm font-medium">Discord 名稱</span>
                  <span className="text-white font-semibold text-lg">{userData.discord || '-'}</span>
                </div>
              </div>
              
                             {isPartner && userData.partner?.halfHourlyRate && (
                 <div className="mt-8 p-4 bg-indigo-600/20 rounded-lg border border-indigo-500/30">
                   <div className="text-indigo-300 mb-2 text-sm font-medium">每半小時收費</div>
                   <span className="text-white font-bold text-xl">{`$${userData.partner.halfHourlyRate}`}</span>
                 </div>
               )}
               
               {isPartner && (
                 <div className="mt-8 p-4 bg-green-600/20 rounded-lg border border-green-500/30">
                   <div className="text-green-300 mb-2 text-sm font-medium">留言板（顧客預約時會看到）</div>
                   <div className="bg-gray-900 rounded p-4 text-white min-h-[60px] border border-green-500/50 text-base">
                     {userData.partner?.customerMessage ? userData.partner.customerMessage : <span className="text-gray-300">（尚未填寫留言）</span>}
                   </div>
                 </div>
               )}
              
              <button 
                className="w-full py-3 rounded-lg bg-indigo-500 text-white font-bold text-lg mt-6 hover:bg-indigo-600 transition" 
                onClick={() => setEditMode(true)}
              >
                修改個人資料
              </button>
              
              {/* 註銷帳號區域 */}
              <div className="mt-8 pt-6 border-t border-red-500/30">
                <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center">
                  <span className="mr-2">⚠️</span>
                  危險操作
                </h3>
                <p className="text-gray-300 text-sm mb-4">
                  註銷帳號將永久刪除您的所有資料，包括個人資料、預約記錄、訂單歷史等，此操作無法復原。
                </p>
                
                {!showDeleteConfirm ? (
                  <button 
                    className="w-full py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    註銷帳號
                  </button>
                ) : !showFinalConfirm ? (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-300 text-sm mb-4">
                      <strong>第一次確認：您確定要註銷帳號嗎？此操作將永久刪除您的所有資料。</strong>
                    </p>
                    <div className="flex gap-3">
                      <button 
                        className="flex-1 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700 transition"
                        onClick={() => setShowFinalConfirm(true)}
                      >
                        確定註銷
                      </button>
                      <button 
                        className="flex-1 py-2 bg-gray-600 text-white font-bold rounded hover:bg-gray-700 transition"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-300 text-sm mb-4">
                      <strong>第二次確認：請輸入確認碼 delect_account 來完成註銷。</strong>
                    </p>
                    <input
                      type="text"
                      value={confirmationCode}
                      onChange={(e) => setConfirmationCode(e.target.value)}
                      placeholder="請輸入確認碼"
                      className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-red-500 focus:border-red-400 focus:outline-none mb-4"
                    />
                    {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
                    <div className="flex gap-3">
                      <button 
                        className="flex-1 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700 transition disabled:opacity-50"
                        onClick={handleDeleteAccount}
                        disabled={deleteLoading}
                      >
                        {deleteLoading ? '處理中...' : '確定註銷'}
                      </button>
                      <button 
                        className="flex-1 py-2 bg-gray-600 text-white font-bold rounded hover:bg-gray-700 transition"
                        onClick={() => {
                          setShowFinalConfirm(false);
                          setShowDeleteConfirm(false);
                          setConfirmationCode('');
                          setError('');
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                <>
                  <div className="mt-6">
                    <label className="block text-gray-300 mb-1 font-semibold">擅長遊戲（最多 10 個，每個限 50 字）</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {ALL_GAMES.map(game => (
                        <button
                          type="button"
                          key={game}
                          className={`px-3 py-1 rounded-full border text-xs font-semibold mr-2 mb-2 ${formData.games.includes(game) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-900 text-gray-300 border-gray-700'}`}
                          onClick={() => handleGameChange(game)}
                          disabled={formData.games.length >= MAX_GAMES && !formData.games.includes(game)}
                        >
                          {game}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={customGame}
                        onChange={e => setCustomGame(e.target.value.slice(0, 50))}
                        className="flex-1 px-3 py-1 rounded bg-gray-900 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none text-xs"
                        placeholder="自訂遊戲名稱（限 50 字）"
                        maxLength={50}
                        disabled={formData.games.length >= MAX_GAMES}
                      />
                      <button
                        type="button"
                        className="px-3 py-1 rounded bg-indigo-500 text-white text-xs font-semibold"
                        onClick={handleAddCustomGame}
                        disabled={!customGame.trim() || formData.games.length >= MAX_GAMES}
                      >新增</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.games.map(game => (
                        <span key={game} className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center mr-2 mb-2">
                          {game}
                          <button type="button" className="ml-2 text-white hover:text-red-300" onClick={() => handleRemoveGame(game)}>&times;</button>
                        </span>
                      ))}
                    </div>
                    <div className="text-right text-xs text-gray-400 mt-1">{formData.games.length}/10</div>
                  </div>
                  <div className="mt-6">
                    <label className="block text-gray-300 mb-1 font-semibold">留言板（顧客預約時會看到，限 50 字）</label>
                    <textarea
                      name="customerMessage"
                      value={formData.customerMessage}
                      onChange={e => {
                        if (e.target.value.length <= 50) handleInputChange(e)
                      }}
                      maxLength={50}
                      className="w-full rounded bg-gray-900 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none p-3 min-h-[40px] text-sm"
                      placeholder="請輸入想對顧客說的話...（限 50 字）"
                    />
                    <div className="text-right text-xs text-gray-400 mt-1">{formData.customerMessage.length}/50</div>
                  </div>
                </>
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

      {/* 預約和訂單管理區塊 */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center">
            <span className="mr-2">📋</span>
            預約與訂單管理
          </h2>
          <p className="text-gray-300 text-sm mb-6">
            {isPartner 
              ? '管理您的服務預約和客戶訂單，查看服務記錄和收入統計'
              : '查看您的預約記錄和消費紀錄，管理服務評價'
            }
          </p>
          
          <div className="space-y-8">
            <section>
              <MyBookings showCompletedOnly />
            </section>
            <section>
              <OrderHistory />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
} 