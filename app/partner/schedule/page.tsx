'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Switch } from '@headlessui/react';

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
  const [showSuccess, setShowSuccess] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<{ isAvailableNow: boolean, isRankBooster: boolean } | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // 動畫樣式
    const style = document.createElement('style');
    style.textContent = `
      .animate-fade-in-out {
        animation: fadeInOut 2s;
      }
      @keyframes fadeInOut {
        0% { opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
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
            setPartnerStatus({
              isAvailableNow: !!data.partner.isAvailableNow,
              isRankBooster: !!data.partner.isRankBooster
            });
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

  // 取得 yyyy-mm-dd（本地時區）
  function getLocalDateString(date: Date) {
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
  }

  // 獲取指定日期和時間的時段（本地時區比對）
  const getScheduleAtTime = (date: Date, timeSlot: string) => {
    const dateStr = getLocalDateString(date);
    const [hour, minute] = timeSlot.split(':');
    const slotStart = new Date(date);
    slotStart.setHours(Number(hour), Number(minute), 0, 0);
    const slotStartTime = slotStart.getTime();
    return schedules.find(schedule => {
      const scheduleDate = new Date(schedule.date);
      const scheduleStart = new Date(schedule.startTime);
      return getLocalDateString(scheduleDate) === dateStr &&
        scheduleStart.getTime() === slotStartTime;
    });
  };

  // 決定每個 cell 的狀態（本地時區比對）
  const getCellState = (date: Date, timeSlot: string): CellState => {
    const now = new Date();
    const [hour, minute] = timeSlot.split(':');
    const timeDate = new Date(date);
    timeDate.setHours(Number(hour), Number(minute), 0, 0);
    if (timeDate.getTime() <= now.getTime()) return 'past';
    const key = `${getLocalDateString(date)}_${timeSlot}`;
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
    const [hour, minute] = timeSlot.split(':');
    const timeDate = new Date(date);
    timeDate.setHours(Number(hour), Number(minute), 0, 0);
    if (timeDate.getTime() <= now.getTime()) return;
    const key = `${getLocalDateString(date)}_${timeSlot}`;
    const schedule = getScheduleAtTime(date, timeSlot);
    if (schedule) {
      if (schedule.booked) return;
      if (pendingDelete[schedule.id]) {
        setPendingDelete(prev => {
          const copy = { ...prev };
          delete copy[schedule.id];
          return copy;
        });
      } else {
        setPendingDelete(prev => ({ ...prev, [schedule.id]: true }));
      }
    } else {
      if (pendingAdd[key]) {
        setPendingAdd(prev => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      } else {
        setPendingAdd(prev => ({ ...prev, [key]: true }));
      }
    }
  };

  // 儲存所有變更
  const handleSave = async () => {
    setSaving(true);
    const addList = Object.keys(pendingAdd).map(key => {
      const [dateStr, timeSlot] = key.split('_');
      const [hour, minute] = timeSlot.split(':');
      const startTime = new Date(dateStr);
      startTime.setHours(Number(hour), Number(minute), 0, 0);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      return {
        date: dateStr,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      };
    });
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
      // 立即清空 pending 狀態，提升體感速度
      setPendingAdd({});
      setPendingDelete({});
      await fetchSchedules(); // 先 fetch 最新資料再顯示成功提示
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      // 可選：自動滾到頂部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert('儲存失敗，請重試');
    }
    setSaving(false);
  };

  const handleToggle = async (field: 'isAvailableNow' | 'isRankBooster', value: boolean) => {
    setPartnerStatus(prev => prev ? { ...prev, [field]: value } : prev);
    await fetch('/api/partners/self', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    });
  };

  const getCellStyle = (state: CellState) => {
    switch (state) {
      case 'empty': return 'bg-white hover:bg-green-100 cursor-pointer';
      case 'toAdd': return 'bg-green-300 border-2 border-green-600 cursor-pointer';
      case 'saved': return 'bg-gray-600 cursor-pointer';
      case 'toDelete': return 'bg-red-300 border-2 border-red-600 cursor-pointer';
      case 'booked': return 'bg-yellow-200 cursor-not-allowed';
      case 'past': return 'bg-gray-100 cursor-not-allowed';
    }
  };

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
    <div className="container mx-auto px-4 py-8 pt-20">
      {showSuccess && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-bold text-lg animate-fade-in-out">
          儲存成功
        </div>
      )}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">未來7天時段管理</h1>
      </div>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
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
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">現在有空</span>
                  <Switch
                    checked={!!partnerStatus?.isAvailableNow}
                    onChange={v => handleToggle('isAvailableNow', v)}
                    className={`${partnerStatus?.isAvailableNow ? 'bg-green-500' : 'bg-gray-300'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                  >
                    <span className="sr-only">現在有空</span>
                    <span
                      className={`${partnerStatus?.isAvailableNow ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">我是上分高手</span>
                  <Switch
                    checked={!!partnerStatus?.isRankBooster}
                    onChange={v => handleToggle('isRankBooster', v)}
                    className={`${partnerStatus?.isRankBooster ? 'bg-indigo-500' : 'bg-gray-300'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                  >
                    <span className="sr-only">我是上分高手</span>
                    <span
                      className={`${partnerStatus?.isRankBooster ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
                <div className="text-sm text-gray-600">
                  {dateRange.start.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} - {dateRange.end.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <div className="min-w-full">
              <div className="flex border-b border-gray-200">
                <div className="w-20 bg-gray-50 border-r border-gray-200 sticky left-0 z-10"></div>
                {dateSlots.map((date, index) => (
                  <div key={index} className="flex-1 min-w-0 w-[110px] bg-gray-50 border-r border-gray-200 p-2 text-center">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {date.getDate()} {['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex">
                <div className="w-20 border-r border-gray-200 sticky left-0 z-10 bg-white">
                  {timeSlots.map((time, index) => (
                    <div key={index} className="h-8 border-b border-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-500">{time}</span>
                    </div>
                  ))}
                </div>
                {dateSlots.map((date, dateIndex) => (
                  <div key={dateIndex} className="flex-1 min-w-0 w-[110px] border-r border-gray-200">
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
                <div className="w-4 h-4 bg-gray-600"></div>
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