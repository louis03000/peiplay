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
  const [currentView, setCurrentView] = useState<'today' | 'nextWeek'>('today');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
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

  const handleViewChange = (view: 'today' | 'nextWeek') => {
    setCurrentView(view);
    const today = new Date();
    if (view === 'today') {
      setDateRange({
        start: today,
        end: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)
      });
    } else {
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      setDateRange({
        start: nextWeek,
        end: new Date(nextWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
      });
    }
  };

  // 生成時間軸（30分鐘間隔）
  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  // 生成日期軸
  const dateSlots = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(dateRange.start);
    date.setDate(date.getDate() + i);
    return date;
  });

  // 獲取指定日期和時間的時段
  const getScheduleAtTime = (date: Date, timeSlot: string) => {
    const dateStr = date.toISOString().split('T')[0];
    const timeDate = new Date(`${dateStr}T${timeSlot}:00`);
    const endTime = new Date(timeDate.getTime() + 30 * 60 * 1000);
    
    return schedules.find(schedule => {
      const scheduleDate = new Date(schedule.date);
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);
      
      return scheduleDate.toDateString() === date.toDateString() &&
             scheduleStart <= timeDate &&
             scheduleEnd > timeDate;
    });
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
        <h1 className="text-3xl font-bold text-white mb-2">未來7天時段管理</h1>
      </div>

      {/* 主要內容區塊 */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* 標題和按鈕區域 */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-bold text-gray-800">未來7天時段管理</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleViewChange('today')}
                    className={`px-4 py-2 rounded text-sm font-medium transition ${
                      currentView === 'today'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    今天
                  </button>
                  <button
                    onClick={() => handleViewChange('nextWeek')}
                    className={`px-4 py-2 rounded text-sm font-medium transition ${
                      currentView === 'nextWeek'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    下週
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {dateRange.start.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} - {dateRange.end.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
              </div>
            </div>
          </div>

          {/* 日曆網格 */}
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* 日期標題行 */}
              <div className="flex border-b border-gray-200">
                <div className="w-20 bg-gray-50 border-r border-gray-200"></div>
                {dateSlots.map((date, index) => (
                  <div key={index} className="w-32 bg-gray-50 border-r border-gray-200 p-2 text-center">
                    <div className="text-sm font-medium text-gray-800">
                      {date.getDate()} {['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}
                    </div>
                  </div>
                ))}
              </div>

              {/* 時間軸和時段網格 */}
              <div className="flex">
                {/* 時間軸 */}
                <div className="w-20 border-r border-gray-200">
                  {timeSlots.map((time, index) => (
                    <div key={index} className="h-8 border-b border-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-500">{time}</span>
                    </div>
                  ))}
                </div>

                {/* 時段網格 */}
                {dateSlots.map((date, dateIndex) => (
                  <div key={dateIndex} className="w-32 border-r border-gray-200">
                    {timeSlots.map((time, timeIndex) => {
                      const schedule = getScheduleAtTime(date, time);
                      return (
                        <div
                          key={timeIndex}
                          className={`h-8 border-b border-gray-100 cursor-pointer transition-colors ${
                            schedule
                              ? schedule.booked
                                ? 'bg-yellow-200 hover:bg-yellow-300'
                                : 'bg-green-200 hover:bg-green-300'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => schedule && !schedule.booked && handleScheduleSelect(schedule.id)}
                        >
                          {schedule && (
                            <div className="w-full h-full flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedSchedules.includes(schedule.id)}
                                onChange={() => !schedule.booked && handleScheduleSelect(schedule.id)}
                                disabled={schedule.booked}
                                className="w-3 h-3 text-blue-600"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 操作按鈕 */}
          {selectedSchedules.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  已選擇 {selectedSchedules.length} 個時段
                </span>
                <button
                  onClick={handleDeleteSchedules}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  刪除選中時段
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}