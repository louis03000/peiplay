'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Schedule {
  id: string
  date: string
  startTime: string
  endTime: string
  isAvailable: boolean
  booked: boolean
}

export default function PartnerSchedulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasPartner, setHasPartner] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    date: '',
    startTime: '',
    endTime: ''
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && status !== "loading" && !session) {
      router.replace('/auth/login');
      return;
    }

    // 檢查是否有夥伴資料，而不是檢查用戶角色
    if (mounted && session?.user?.id) {
      fetch('/api/partners/self')
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to fetch partner status');
          }
          return res.json();
        })
        .then(data => {
          if (data && data.partner) {
            setHasPartner(true);
            setLoading(false);
            fetchSchedules();
          } else {
            // 沒有夥伴資料，重定向到個人資料頁面
            router.replace('/profile');
          }
        })
        .catch(() => {
          // 錯誤時重定向到個人資料頁面
          router.replace('/profile');
        });
    }
  }, [mounted, status, session, router]);

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/partner/schedule');
      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const handleAddSchedule = async () => {
    try {
      const response = await fetch('/api/partner/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSchedule),
      });

      if (response.ok) {
        setNewSchedule({ date: '', startTime: '', endTime: '' });
        setShowAddForm(false);
        fetchSchedules();
      } else {
        const error = await response.json();
        alert(error.error || '新增時段失敗');
      }
    } catch (error) {
      alert('新增時段失敗');
    }
  };

  const handleDeleteSchedules = async () => {
    if (selectedSchedules.length === 0) {
      alert('請選擇要刪除的時段');
      return;
    }

    if (!confirm('確定要刪除選中的時段嗎？')) {
      return;
    }

    try {
      const schedulesToDelete = schedules
        .filter(s => selectedSchedules.includes(s.id))
        .map(s => ({
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime
        }));

      const response = await fetch('/api/partner/schedule', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(schedulesToDelete),
      });

      if (response.ok) {
        setSelectedSchedules([]);
        fetchSchedules();
      } else {
        const error = await response.json();
        alert(error.error || '刪除時段失敗');
      }
    } catch (error) {
      alert('刪除時段失敗');
    }
  };

  const handleScheduleSelect = (scheduleId: string) => {
    setSelectedSchedules(prev => 
      prev.includes(scheduleId) 
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };

  // 如果還在載入或未掛載，顯示載入狀態
  if (status === 'loading' || !mounted || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">載入中...</div>
        </div>
      </div>
    );
  }

  // 如果未登入，顯示載入狀態（會自動跳轉到登入頁面）
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">重新導向到登入頁面...</div>
        </div>
      </div>
    );
  }

  // 如果沒有夥伴資料，顯示載入狀態（會自動跳轉到個人資料頁面）
  if (!hasPartner) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">重新導向到個人資料頁面...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 頁面標題 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">夥伴時段管理</h1>
        <p className="text-gray-300">
          管理您的服務時段和可用性設定
        </p>
      </div>

      {/* 主要內容區塊 */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center">
              <span className="mr-2">📅</span>
              時段管理
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                新增時段
              </button>
              {selectedSchedules.length > 0 && (
                <button
                  onClick={handleDeleteSchedules}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  刪除選中 ({selectedSchedules.length})
                </button>
              )}
            </div>
          </div>

          {/* 新增時段表單 */}
          {showAddForm && (
            <div className="bg-gray-800/60 p-6 rounded-lg mb-6">
              <h3 className="text-lg font-bold text-white mb-4">新增時段</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="date"
                  value={newSchedule.date}
                  onChange={(e) => setNewSchedule({...newSchedule, date: e.target.value})}
                  className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                  placeholder="選擇日期"
                />
                <input
                  type="time"
                  value={newSchedule.startTime}
                  onChange={(e) => setNewSchedule({...newSchedule, startTime: e.target.value})}
                  className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                  placeholder="開始時間"
                />
                <input
                  type="time"
                  value={newSchedule.endTime}
                  onChange={(e) => setNewSchedule({...newSchedule, endTime: e.target.value})}
                  className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                  placeholder="結束時間"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddSchedule}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  確認新增
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 時段列表 */}
          <div className="bg-gray-800/60 p-6 rounded-lg">
            {schedules.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-3">📅</div>
                <p className="text-gray-300 text-lg mb-2">目前沒有任何時段</p>
                <p className="text-gray-400 text-sm">點擊「新增時段」開始設定您的服務時間</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedSchedules.includes(schedule.id)
                        ? 'border-blue-500 bg-blue-900/20'
                        : schedule.booked
                        ? 'border-yellow-500 bg-yellow-900/20'
                        : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                    }`}
                    onClick={() => !schedule.booked && handleScheduleSelect(schedule.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="checkbox"
                        checked={selectedSchedules.includes(schedule.id)}
                        onChange={() => !schedule.booked && handleScheduleSelect(schedule.id)}
                        disabled={schedule.booked}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                      />
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        schedule.booked 
                          ? 'bg-yellow-600 text-white' 
                          : 'bg-green-600 text-white'
                      }`}>
                        {schedule.booked ? '已預約' : '可預約'}
                      </span>
                    </div>
                    <div className="text-white">
                      <div className="font-semibold">
                        {new Date(schedule.date).toLocaleDateString('zh-TW')}
                      </div>
                      <div className="text-sm text-gray-300">
                        {new Date(schedule.startTime).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: false 
                        })} - {new Date(schedule.endTime).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: false 
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}