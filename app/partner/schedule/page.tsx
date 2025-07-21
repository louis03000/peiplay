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

type CellState = 'empty' | 'toAdd' | 'saved' | 'toDelete' | 'booked' | 'past';

export default function PartnerSchedulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasPartner, setHasPartner] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [pendingAdd, setPendingAdd] = useState<{[key: string]: boolean}>({});
  const [pendingDelete, setPendingDelete] = useState<{[key: string]: boolean}>({});
  const [currentView, setCurrentView] = useState<'today' | 'nextWeek'>('today');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && status !== "loading" && !session) {
      router.replace('/auth/login');
      return;
    }
    if (mounted && session?.user?.id) {
      fetch('/api/partners/self')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch partner status');
          return res.json();
        })
        .then(data => {
          if (data && data.partner) {
            setHasPartner(true);
            setLoading(false);
            fetchSchedules();
          } else {
            router.replace('/profile');
          }
        })
        .catch(() => router.replace('/profile'));
    }
  }, [mounted, status, session, router]);

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/partner/schedule');
      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
        setPendingAdd({});
        setPendingDelete({});
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
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
    return schedules.find(schedule => {
      const scheduleDate = new Date(schedule.date);
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);
      return scheduleDate.toDateString() === date.toDateString() &&
             scheduleStart <= timeDate &&
             scheduleEnd > timeDate;
    });
  };

  // 決定每個 cell 的狀態
  const getCellState = (date: Date, timeSlot: string): CellState => {
    const now = new Date();
    const timeDate = new Date(`${date.toISOString().split('T')[0]}T${timeSlot}:00`);
    if (timeDate <= now) return 'past';
    const key = `${date.toISOString().split('T')[0]}_${timeSlot}`;
    const schedule = getScheduleAtTime(date, timeSlot);
    if (schedule) {
      if (schedule.booked) return 'booked';
      if (pendingDelete[schedule.id]) return 'toDelete';
      return 'saved';
    } else {
      if (pendingAdd[key]) return 'toAdd';
      return 'empty';
    }
  };

  // 點擊 cell 的行為
  const handleCellClick = (date: Date, timeSlot: string) => {
    const now = new Date();
    const timeDate = new Date(`${date.toISOString().split('T')[0]}T${timeSlot}:00`);
    if (timeDate <= now) return;
    const key = `${date.toISOString().split('T')[0]}_${timeSlot}`;
    const schedule = getScheduleAtTime(date, timeSlot);
    if (schedule) {
      if (schedule.booked) return;
      if (pendingDelete[schedule.id]) {
        // 再點一次取消刪除
        setPendingDelete(prev => {
          const copy = { ...prev };
          delete copy[schedule.id];
          return copy;
        });
      } else {
        // 標記為待刪除
        setPendingDelete(prev => ({ ...prev, [schedule.id]: true }));
      }
    } else {
      if (pendingAdd[key]) {
        // 再點一次取消新增
        setPendingAdd(prev => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      } else {
        // 標記為待新增
        setPendingAdd(prev => ({ ...prev, [key]: true }));
      }
    }
  };

  // 儲存所有變更
  const handleSave = async () => {
    setSaving(true);
    // 新增
    const addList = Object.keys(pendingAdd).map(key => {
      const [dateStr, timeSlot] = key.split('_');
      const startTime = new Date(`${dateStr}T${timeSlot}:00`);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      return {
        date: dateStr,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      };
    });
    // 刪除
    const deleteList = Object.keys(pendingDelete).map(id => {
      const schedule = schedules.find(s => s.id === id);
      return schedule ? {
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime
      } : null;
    }).filter(Boolean);
    try {
      if (addList.length > 0) {
        await fetch('/api/partner/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addList.length === 1 ? addList[0] : addList)
        });
      }
      if (deleteList.length > 0) {
        await fetch('/api/partner/schedule', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deleteList)
        });
      }
      await fetchSchedules();
    } catch (e) {
      alert('儲存失敗，請重試');
    }
    setSaving(false);
  };

  // 樣式
  const getCellStyle = (state: CellState) => {
    switch (state) {
      case 'empty': return 'bg-white hover:bg-green-100 cursor-pointer';
      case 'toAdd': return 'bg-green-300 border-2 border-green-600 cursor-pointer';
      case 'saved': return 'bg-gray-300 cursor-pointer';
      case 'toDelete': return 'bg-red-300 border-2 border-red-600 cursor-pointer';
      case 'booked': return 'bg-yellow-200 cursor-not-allowed';
      case 'past': return 'bg-gray-100 cursor-not-allowed';
    }
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
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">重新導向到登入頁面...</div>
        </div>
      </div>
    );
  }
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
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">未來7天時段管理</h1>
      </div>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-bold text-gray-800">未來7天時段管理</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleViewChange('today')}
                    className={`px-4 py-2 rounded text-sm font-medium transition ${currentView === 'today' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >今天</button>
                  <button
                    onClick={() => handleViewChange('nextWeek')}
                    className={`px-4 py-2 rounded text-sm font-medium transition ${currentView === 'nextWeek' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >下週</button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {dateRange.start.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} - {dateRange.end.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-max">
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
              <div className="flex">
                <div className="w-20 border-r border-gray-200">
                  {timeSlots.map((time, index) => (
                    <div key={index} className="h-8 border-b border-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-500">{time}</span>
                    </div>
                  ))}
                </div>
                {dateSlots.map((date, dateIndex) => (
                  <div key={dateIndex} className="w-32 border-r border-gray-200">
                    {timeSlots.map((time, timeIndex) => {
                      const state = getCellState(date, time);
                      return (
                        <div
                          key={timeIndex}
                          className={`h-8 border-b border-gray-100 transition-colors ${getCellStyle(state)}`}
                          onClick={() => ['empty', 'toAdd', 'saved', 'toDelete'].includes(state) && handleCellClick(date, time)}
                          title={
                            state === 'past' ? '過去的時間無法操作' :
                            state === 'empty' ? '點擊新增時段' :
                            state === 'toAdd' ? '點擊取消新增' :
                            state === 'saved' ? '點擊標記刪除' :
                            state === 'toDelete' ? '點擊取消刪除' :
                            state === 'booked' ? '已預約的時段無法操作' : ''
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-white border border-gray-300"></div>
                <span className="text-gray-600">未設定時段</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-300 border-2 border-green-600"></div>
                <span className="text-gray-600">待儲存時段</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-300"></div>
                <span className="text-gray-600">已儲存時段</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-300 border-2 border-red-600"></div>
                <span className="text-gray-600">待刪除時段</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-200"></div>
                <span className="text-gray-600">已預約時段</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-100"></div>
                <span className="text-gray-600">過去時間</span>
              </div>
            </div>
            <button
              className={`px-6 py-2 rounded-lg font-bold text-white transition ${saving ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              onClick={handleSave}
              disabled={saving || (Object.keys(pendingAdd).length === 0 && Object.keys(pendingDelete).length === 0)}
            >
              {saving ? '儲存中...' : '儲存時段'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}