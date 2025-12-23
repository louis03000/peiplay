'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  const [partnerStatus, setPartnerStatus] = useState<{ 
    id: string;
    isAvailableNow: boolean; 
    isRankBooster: boolean; 
    allowGroupBooking: boolean;
    availableNowSince: string | null;
  } | null>(null);
  const [partnerGames, setPartnerGames] = useState<string[]>([]);
  const [rankBoosterImages, setRankBoosterImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<boolean[]>(new Array(5).fill(false));
  
  // 群組預約相關狀態
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupForm, setGroupForm] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    pricePerPerson: 0,
    maxParticipants: 4,
    games: [] as string[]
  });
  const [customGameInput, setCustomGameInput] = useState('');
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // 動畫樣式
    const style = document.createElement('style');
    style.textContent = `
      .animate-fade-in-out {
        animation: fadeInOut 3s ease-in-out;
      }
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -20px); }
        15% { opacity: 1; transform: translate(-50%, 0); }
        85% { opacity: 1; transform: translate(-50%, 0); }
        100% { opacity: 0; transform: translate(-50%, -20px); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // 設置30分鐘自動關閉定時器
  useEffect(() => {
    // 清除之前的定時器
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    // 如果「現在有空」是開啟的，設置30分鐘後自動關閉
    if (partnerStatus?.isAvailableNow && partnerStatus?.availableNowSince) {
      const openedAt = new Date(partnerStatus.availableNowSince);
      const now = new Date();
      const elapsed = now.getTime() - openedAt.getTime();
      const remaining = 30 * 60 * 1000 - elapsed; // 30分鐘的毫秒數

      if (remaining > 0) {
        // 如果還沒超過30分鐘，設置剩餘時間的定時器
        autoCloseTimerRef.current = setTimeout(async () => {
          // 30分鐘後自動關閉
          const updateData = { 
            isAvailableNow: false, 
            availableNowSince: null 
          };
          setPartnerStatus(prev => prev ? { ...prev, isAvailableNow: false, availableNowSince: null } : prev);
          await fetch('/api/partners/self', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          });
          console.log('⏰ 「現在有空」已自動關閉（30分鐘後）');
        }, remaining);
        console.log(`⏰ 設置「現在有空」自動關閉定時器，剩餘時間: ${Math.round(remaining / 1000 / 60)} 分鐘`);
      } else {
        // 如果已經超過30分鐘，立即關閉
        console.log('⏰ 「現在有空」已開啟超過30分鐘，立即關閉');
        const updateData = { 
          isAvailableNow: false, 
          availableNowSince: null 
        };
        setPartnerStatus(prev => prev ? { ...prev, isAvailableNow: false, availableNowSince: null } : prev);
        fetch('/api/partners/self', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        }).catch(err => console.error('自動關閉失敗:', err));
      }
    }

    // 清理函數：組件卸載時清除定時器
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [partnerStatus?.isAvailableNow, partnerStatus?.availableNowSince]);

  // 定期更新夥伴狀態（同步後端狀態，不自動關閉）
  useEffect(() => {
    if (!mounted) return;

    // 每2分鐘更新一次狀態（檢查是否被後台自動關閉或手動修改）
    const interval = setInterval(() => refreshData(), 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageUpload = async (index: number, file: File) => {
    if (!file) return;

    // 驗證文件類型
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片文件');
      return;
    }

    // 驗證文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('圖片大小不能超過5MB');
      return;
    }

    setUploadingImages(prev => {
      const newState = [...prev];
      newState[index] = true;
      return newState;
    });

    try {
      // 上傳圖片到 Cloudinary
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || '上傳圖片失敗');
      }

      const uploadData = await uploadResponse.json();
      if (!uploadData.url) {
        throw new Error('上傳後未收到圖片URL');
      }

      // 更新圖片陣列
      const newImages = [...rankBoosterImages];
      newImages[index] = uploadData.url;
      setRankBoosterImages(newImages);

      // 保存到後端
      const response = await fetch('/api/partners/rank-booster-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: newImages.filter(img => img) // 只保存非空的圖片
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || '保存圖片失敗';
        console.error('保存圖片失敗:', errorData);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      // 成功提示
      console.log('圖片上傳成功:', result);

    } catch (error) {
      console.error('上傳圖片失敗:', error);
      const errorMessage = error instanceof Error ? error.message : '上傳圖片失敗，請重試';
      alert(errorMessage);
      // 恢復原來的圖片
      const newImages = [...rankBoosterImages];
      newImages[index] = rankBoosterImages[index] || '';
      setRankBoosterImages(newImages);
    } finally {
      setUploadingImages(prev => {
        const newState = [...prev];
        newState[index] = false;
        return newState;
      });
    }
  };

  useEffect(() => {
    if (mounted && status !== "loading" && !session) {
      router.replace('/auth/login');
      return;
    }
    
    if (mounted && session?.user?.id) {
      // 使用新的dashboard API一次性獲取所有數據
      // dashboard API 會檢查 role 或 partner status
      fetch('/api/partner/dashboard')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch dashboard data');
          return res.json();
        })
        .then(data => {
          if (data && data.partner) {
            setHasPartner(true);
            setLoading(false);
            setError(null);
            // 從數據庫獲取真實狀態（確保「我是上分高手」和「允許群組預約」的狀態正確恢復）
            let isAvailableNow = !!data.partner.isAvailableNow;
            let availableNowSince = data.partner.availableNowSince;
            
            // 如果「現在有空」是開啟的，檢查是否超過30分鐘
            if (isAvailableNow && availableNowSince) {
              const openedAt = new Date(availableNowSince);
              const now = new Date();
              const elapsed = now.getTime() - openedAt.getTime();
              if (elapsed > 30 * 60 * 1000) {
                // 超過30分鐘，自動關閉
                isAvailableNow = false;
                availableNowSince = null;
                // 更新數據庫中的狀態
                fetch('/api/partners/self', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    isAvailableNow: false, 
                    availableNowSince: null 
                  })
                }).catch(err => console.error('自動關閉失敗:', err));
              }
            }
            
            // 確保從 API 正確讀取狀態（使用 !! 確保是 boolean）
            const partnerStatusData = {
              id: data.partner.id,
              isAvailableNow: isAvailableNow,
              isRankBooster: !!data.partner.isRankBooster, // 從數據庫恢復狀態，確保是 boolean
              allowGroupBooking: !!data.partner.allowGroupBooking, // 從數據庫恢復狀態，確保是 boolean
              availableNowSince: availableNowSince
            };
            
            console.log('📥 從數據庫載入狀態:', {
              isAvailableNow: partnerStatusData.isAvailableNow,
              isRankBooster: partnerStatusData.isRankBooster,
              allowGroupBooking: partnerStatusData.allowGroupBooking
            });
            
            setPartnerStatus(partnerStatusData);
            setRankBoosterImages(data.partner.rankBoosterImages || []);
            setPartnerGames(data.partner.games || []);
            setSchedules(data.schedules || []);
            setMyGroups(data.groups || []);
          } else {
            router.replace('/profile');
          }
        })
        .catch((err) => {
          console.error('Failed to load dashboard data:', err);
          setError('載入資料失敗，請稍後再試');
          setLoading(false);
          // 快速重試一次，如果還失敗就不再重試
          if (retryCount < 1) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              setLoading(true);
            }, 500); // 減少等待時間到 500ms
          }
        });
    }
  }, [mounted, status, session, router, retryCount]);

  const refreshData = async () => {
    try {
      const response = await fetch('/api/partner/dashboard');
      const data = await response.json();
      
      // 無論 API 是否成功，都嘗試處理數據
      if (data && data.partner) {
        // 直接使用 API 返回的狀態（數據庫中的真實狀態）
        let isAvailableNow = !!data.partner.isAvailableNow;
        let availableNowSince = data.partner.availableNowSince;
        
        // 如果「現在有空」是開啟的，檢查是否超過30分鐘
        if (isAvailableNow && availableNowSince) {
          const openedAt = new Date(availableNowSince);
          const now = new Date();
          const elapsed = now.getTime() - openedAt.getTime();
          if (elapsed > 30 * 60 * 1000) {
            // 超過30分鐘，自動關閉
            isAvailableNow = false;
            availableNowSince = null;
          }
        }
        
        // 使用 API 返回的狀態（數據庫中的真實狀態）
        const newStatus = {
          id: data.partner.id,
          isAvailableNow: isAvailableNow,
          isRankBooster: !!data.partner.isRankBooster, // 使用 API 返回的狀態（數據庫中的真實狀態）
          allowGroupBooking: !!data.partner.allowGroupBooking, // 使用 API 返回的狀態（數據庫中的真實狀態）
          availableNowSince: availableNowSince
        };
        
        console.log('🔄 refreshData 更新狀態:', {
          isAvailableNow: newStatus.isAvailableNow,
          isRankBooster: newStatus.isRankBooster,
          allowGroupBooking: newStatus.allowGroupBooking
        });
        
        setPartnerStatus(newStatus);
        setRankBoosterImages(data.partner.rankBoosterImages || []);
        setPartnerGames(data.partner.games || []);
        setSchedules(data.schedules || []);
        setMyGroups(data.groups || []);
        
        // 如果有錯誤信息，在控制台顯示但不影響用戶體驗
        if (data.error) {
          console.warn('API 警告:', data.error);
        }
      } else {
        // 如果沒有數據，只有在初始化時才設置默認值（不重置已有狀態）
        setPartnerStatus(prev => {
          if (!prev) {
            return {
              id: '',
              isAvailableNow: false,
              isRankBooster: false,
              allowGroupBooking: false,
              availableNowSince: null
            };
          }
          // 如果已有狀態，保持不變
          return prev;
        });
        // 其他數據只有在沒有數據時才重置
        if (!data || !data.partner) {
          // 只有在真正沒有數據時才重置（避免覆蓋已存在的狀態）
          // 這裡不重置，因為可能是臨時錯誤
        }
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      // 錯誤時不重置狀態，保持當前狀態（避免網絡問題導致狀態丟失）
      // 只有在初始化時才設置默認值
      setPartnerStatus(prev => {
        if (!prev) {
          return {
            id: '',
            isAvailableNow: false,
            isRankBooster: false,
            allowGroupBooking: false,
            availableNowSince: null
          };
        }
        return prev;
      });
    }
  };

  const handleAddCustomGame = () => {
    const trimmed = customGameInput.trim();
    if (trimmed && !groupForm.games.includes(trimmed) && trimmed.length <= 50 && groupForm.games.length < 10) {
      setGroupForm({
        ...groupForm,
        games: [...groupForm.games, trimmed]
      });
      setCustomGameInput('');
    }
  };

  const createGroup = async () => {
    if (!groupForm.title || !groupForm.date || !groupForm.startTime || !groupForm.endTime || !groupForm.pricePerPerson) {
      alert('請填寫所有必要欄位');
      return;
    }

    if (groupForm.maxParticipants > 9 || groupForm.maxParticipants < 2) {
      alert('最大人數必須在2到9人之間');
      return;
    }

    if (groupForm.pricePerPerson <= 0) {
      alert('每人費用必須大於0');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      // 調試：記錄發送的資料
      console.log('🔍 準備發送群組預約資料:', groupForm);
      console.log('🔍 資料類型檢查:', {
        title: { value: groupForm.title, type: typeof groupForm.title },
        date: { value: groupForm.date, type: typeof groupForm.date },
        startTime: { value: groupForm.startTime, type: typeof groupForm.startTime },
        endTime: { value: groupForm.endTime, type: typeof groupForm.endTime },
        pricePerPerson: { value: groupForm.pricePerPerson, type: typeof groupForm.pricePerPerson },
        maxParticipants: { value: groupForm.maxParticipants, type: typeof groupForm.maxParticipants },
        games: { value: groupForm.games, type: typeof groupForm.games, isArray: Array.isArray(groupForm.games) },
      });
      
      const requestBody = JSON.stringify(groupForm);
      console.log('🔍 實際發送的 JSON:', requestBody);
      
      const response = await fetch('/api/partner/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody
      });

      const result = await response.json();

      if (response.ok) {
        alert('群組創建成功！');
        setShowGroupForm(false);
        setGroupForm({
          title: '',
          description: '',
          date: '',
          startTime: '',
          endTime: '',
          pricePerPerson: 0,
          maxParticipants: 4,
          games: []
        });
        setCustomGameInput('');
        refreshData();
      } else {
        // 顯示詳細的錯誤訊息
        const errorMessage = result.details 
          ? `${result.error}\n${result.details}` 
          : result.error || '創建失敗';
        alert(errorMessage);
        console.error('創建群組失敗:', result);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      alert(`創建失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setSaving(false);
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

  // 生成時間軸（30分鐘間隔）- 使用useMemo優化
  const timeSlots = useMemo(() => 
    Array.from({ length: 48 }, (_, i) => {
      const hour = Math.floor(i / 2);
      const minute = (i % 2) * 30;
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }), []
  );

  // 生成日期軸 - 使用useMemo優化
  const dateSlots = useMemo(() => 
    Array.from({ length: 7 }, (_, i) => {
      const date = new Date(dateRange.start);
      date.setDate(date.getDate() + i);
      return date;
    }), [dateRange.start]
  );

  // 取得 yyyy-mm-dd（本地時區）- 使用useCallback優化
  const getLocalDateString = useCallback((date: Date) => {
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
  }, []);

  // 獲取指定日期和時間的時段（本地時區比對）- 使用useCallback優化
  const getScheduleAtTime = useCallback((date: Date, timeSlot: string) => {
    const dateStr = getLocalDateString(date);
    const [hour, minute] = timeSlot.split(':');
    
    // 創建本地時間的 slotStart
    const slotStart = new Date(date);
    slotStart.setHours(Number(hour), Number(minute), 0, 0);
    
    return schedules.find(schedule => {
      // 將資料庫的 UTC 時間轉換為本地時間進行比較
      const scheduleDate = new Date(schedule.date);
      const scheduleStart = new Date(schedule.startTime);
      
      // 比較日期（本地時區）
      const scheduleDateStr = getLocalDateString(scheduleDate);
      if (scheduleDateStr !== dateStr) return false;
      
      // 比較時間（本地時區）
      const scheduleStartLocal = new Date(scheduleStart);
      const slotStartLocal = new Date(slotStart);
      
      return scheduleStartLocal.getTime() === slotStartLocal.getTime();
    });
  }, [schedules, getLocalDateString]);

  // 決定每個 cell 的狀態（本地時區比對）- 使用useCallback優化
  const getCellState = useCallback((date: Date, timeSlot: string): CellState => {
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
  }, [getLocalDateString, getScheduleAtTime, pendingDelete, pendingAdd]);

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
      await refreshData(); // 先 fetch 最新資料再顯示成功提示
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      // 可選：自動滾到頂部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert('儲存失敗，請重試');
    }
    setSaving(false);
  };

  const handleToggle = async (field: 'isAvailableNow' | 'isRankBooster' | 'allowGroupBooking', value: boolean) => {
    // 保存舊狀態，以便在 API 失敗時回滾
    const oldStatus = partnerStatus;
    
    const updateData: any = { [field]: value };
    
    // 如果是開啟「現在有空」，記錄開啟時間
    if (field === 'isAvailableNow' && value) {
      updateData.availableNowSince = new Date().toISOString();
    }
    // 如果是關閉「現在有空」，清除開啟時間
    else if (field === 'isAvailableNow' && !value) {
      updateData.availableNowSince = null;
    }
    
    // 先更新本地狀態（樂觀更新）
    setPartnerStatus(prev => prev ? { ...prev, [field]: value, availableNowSince: updateData.availableNowSince } : prev);
    
    try {
      const response = await fetch('/api/partners/self', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '更新失敗');
      }
      
      const result = await response.json();
      // API 成功後，使用 API 返回的狀態確保同步
      if (result.partner) {
        setPartnerStatus({
          id: result.partner.id,
          isAvailableNow: !!result.partner.isAvailableNow,
          isRankBooster: !!result.partner.isRankBooster,
          allowGroupBooking: !!result.partner.allowGroupBooking,
          availableNowSince: result.partner.availableNowSince
        });
      }
      
      console.log(`✅ ${field} 已更新為 ${value}`);
    } catch (error) {
      console.error(`❌ 更新 ${field} 失敗:`, error);
      // API 失敗時，回滾到舊狀態
      if (oldStatus) {
        setPartnerStatus(oldStatus);
      }
      alert(`更新失敗，請重試: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  };

  const getCellStyle = (state: CellState) => {
    switch (state) {
      case 'empty': return 'bg-white hover:bg-green-100 cursor-pointer';
      case 'toAdd': return 'bg-green-300 border-2 border-green-600 cursor-pointer';
      case 'saved': return 'bg-gray-500 text-white cursor-pointer hover:bg-gray-400';
      case 'toDelete': return 'bg-red-300 border-2 border-red-600 cursor-pointer';
      case 'booked': return 'bg-yellow-200 cursor-not-allowed';
      case 'past': return 'bg-gray-100 cursor-not-allowed';
    }
  };

  if (status === 'loading' || !mounted || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"></div>
          <div className="text-gray-700 text-lg">載入中...</div>
          <div className="text-gray-600 text-sm mt-2">正在獲取您的時段資料</div>
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
  if (error && !loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">{error}</div>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              setRetryCount(0);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重新載入
          </button>
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
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 pt-4 sm:pt-8">
      {showSuccess && (
        <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-4 sm:px-8 py-2 sm:py-4 rounded-lg shadow-2xl font-bold text-lg sm:text-xl animate-fade-in-out border-2 border-green-400">
          ✅ 儲存成功！
        </div>
      )}
      <div className="text-center mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">未來7天時段管理</h1>
      </div>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
          <div className="p-3 sm:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">未來7天時段管理</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleViewChange('today')}
                    className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium transition ${currentView === 'today' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >今天</button>
                  <button
                    onClick={() => handleViewChange('nextWeek')}
                    className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium transition ${currentView === 'nextWeek' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >下週</button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-gray-700">現在有空</span>
                    <Switch
                      checked={!!partnerStatus?.isAvailableNow}
                      onChange={v => handleToggle('isAvailableNow', v)}
                      className={`${partnerStatus?.isAvailableNow ? 'bg-green-500' : 'bg-gray-300'} relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors`}
                    >
                      <span className="sr-only">現在有空</span>
                      <span
                        className={`${partnerStatus?.isAvailableNow ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'} inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </Switch>
                  </div>
                  {partnerStatus?.isAvailableNow && (
                    <div className="text-xs text-orange-600 font-medium">
                      ⏰ 每30分鐘會自動關閉
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-gray-700">我是上分高手</span>
                  <Switch
                    checked={!!partnerStatus?.isRankBooster}
                    onChange={v => handleToggle('isRankBooster', v)}
                    className={`${partnerStatus?.isRankBooster ? 'bg-indigo-500' : 'bg-gray-300'} relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors`}
                  >
                    <span className="sr-only">我是上分高手</span>
                    <span
                      className={`${partnerStatus?.isRankBooster ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'} inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-gray-700">允許多人陪玩</span>
                  <Switch
                    checked={!!partnerStatus?.allowGroupBooking}
                    onChange={v => handleToggle('allowGroupBooking', v)}
                    className={`${partnerStatus?.allowGroupBooking ? 'bg-green-500' : 'bg-gray-300'} relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors`}
                  >
                    <span className="sr-only">允許多人陪玩</span>
                    <span
                      className={`${partnerStatus?.allowGroupBooking ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'} inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  {dateRange.start.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} - {dateRange.end.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                </div>
              </div>
            </div>
            
            {/* 上分高手圖片上傳區域 */}
            {partnerStatus?.isRankBooster && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg mt-4">
                <h3 className="text-lg font-semibold text-indigo-800 mb-3">🏆 段位證明圖片</h3>
                <p className="text-sm text-indigo-600 mb-4">
                  請上傳您的遊戲段位截圖作為證明（最多5張圖片）
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map((index) => (
                    <div key={index} className="relative">
                      {rankBoosterImages[index - 1] ? (
                        <div className="aspect-square border-2 border-indigo-300 rounded-lg overflow-hidden bg-white">
                          <img 
                            src={rankBoosterImages[index - 1]} 
                            alt={`段位證明 ${index}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                            <button
                              onClick={() => {
                                const newImages = [...rankBoosterImages];
                                newImages[index - 1] = '';
                                setRankBoosterImages(newImages);
                              }}
                              className="opacity-0 hover:opacity-100 bg-red-500 text-white rounded-full p-1 transition-opacity"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="aspect-square border-2 border-dashed border-indigo-300 rounded-lg flex items-center justify-center bg-white hover:border-indigo-400 transition-colors cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleImageUpload(index - 1, file);
                              }
                            }}
                            disabled={uploadingImages[index - 1]}
                          />
                          <div className="text-center">
                            {uploadingImages[index - 1] ? (
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                            ) : (
                              <>
                                <svg className="mx-auto h-8 w-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <p className="text-xs text-indigo-500 mt-1">上傳圖片</p>
                              </>
                            )}
                          </div>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-indigo-500">
                  💡 建議上傳：遊戲內段位截圖、排行榜截圖、戰績截圖等
                </div>
              </div>
            )}

            {/* 群組預約管理區域 */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-green-800">🎮 群組預約管理</h3>
                  <button
                    onClick={() => setShowGroupForm(!showGroupForm)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {showGroupForm ? '取消' : '創建新群組'}
                  </button>
                </div>

                {/* 創建群組表單 */}
                {showGroupForm && (
                  <div className="bg-white rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-800 mb-3">創建新群組預約</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">群組標題 *</label>
                        <input
                          type="text"
                          value={groupForm.title}
                          onChange={(e) => setGroupForm({...groupForm, title: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                          placeholder="例如：一起上分！"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
                        <input
                          type="date"
                          value={groupForm.date}
                          onChange={(e) => setGroupForm({...groupForm, date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">開始時間 *</label>
                        <input
                          type="time"
                          value={groupForm.startTime}
                          onChange={(e) => setGroupForm({...groupForm, startTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">結束時間 *</label>
                        <input
                          type="time"
                          value={groupForm.endTime}
                          onChange={(e) => setGroupForm({...groupForm, endTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">每人費用 *</label>
                        <input
                          type="number"
                          value={groupForm.pricePerPerson}
                          onChange={(e) => setGroupForm({...groupForm, pricePerPerson: parseInt(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                          placeholder="例如：100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">最大人數 (最多9人)</label>
                        <select
                          value={groupForm.maxParticipants}
                          onChange={(e) => setGroupForm({...groupForm, maxParticipants: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                        >
                          {[2,3,4,5,6,7,8,9].map(num => (
                            <option key={num} value={num}>{num} 人</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">遊戲 (可選，最多 10 個)</label>
                        
                        {/* 已選遊戲顯示為標籤 */}
                        {groupForm.games.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {groupForm.games.map((game, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                              >
                                {game}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGroupForm({
                                      ...groupForm,
                                      games: groupForm.games.filter((_, i) => i !== idx)
                                    });
                                  }}
                                  className="ml-2 text-indigo-600 hover:text-indigo-900"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* 從已有遊戲快速選擇 */}
                        {partnerGames.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-2">快速選擇：</p>
                            <div className="flex flex-wrap gap-2">
                              {partnerGames
                                .filter(game => !groupForm.games.includes(game))
                                .map(game => (
                                  <button
                                    key={game}
                                    type="button"
                                    onClick={() => {
                                      if (groupForm.games.length < 10) {
                                        setGroupForm({
                                          ...groupForm,
                                          games: [...groupForm.games, game]
                                        });
                                      }
                                    }}
                                    disabled={groupForm.games.length >= 10}
                                    className="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    + {game}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 自訂遊戲輸入 */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customGameInput}
                            onChange={(e) => setCustomGameInput(e.target.value.slice(0, 50))}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomGame();
                              }
                            }}
                            placeholder="輸入遊戲名稱（最多 50 字）"
                            maxLength={50}
                            disabled={groupForm.games.length >= 10}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomGame}
                            disabled={!customGameInput.trim() || groupForm.games.length >= 10}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            新增
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {groupForm.games.length}/10 {partnerGames.length > 0 ? '（可從上方快速選擇，或自行輸入）' : '（可直接輸入遊戲名稱）'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">群組描述</label>
                      <textarea
                        value={groupForm.description}
                        onChange={(e) => setGroupForm({...groupForm, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                        rows={3}
                        placeholder="描述群組的目標或規則..."
                      />
                    </div>
                    <div className="flex justify-end space-x-3 mt-4">
                      <button
                        onClick={() => setShowGroupForm(false)}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={createGroup}
                        disabled={saving}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? '創建中...' : '創建群組'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 我的群組列表 */}
                <div className="mt-4">
                  <h4 className="font-semibold text-gray-800 mb-3">我的群組預約</h4>
                  {myGroups.length > 0 ? (
                    <div className="space-y-3">
                      {myGroups.map((group) => (
                        <div key={group.id} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium text-gray-900">{group.title}</h5>
                              <p className="text-sm text-gray-600">{group.description}</p>
                              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                <span>📅 {new Date(group.startTime).toLocaleDateString('zh-TW')}</span>
                                <span>⏰ {new Date(group.startTime).toLocaleTimeString('zh-TW', {hour: '2-digit', minute: '2-digit'})}</span>
                                <span>💰 ${group.pricePerPerson}/人</span>
                                <span>👥 {group.currentParticipants}/{group.maxParticipants} 人</span>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                group.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                group.status === 'FULL' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {group.status === 'ACTIVE' ? '開放中' :
                                 group.status === 'FULL' ? '已滿' : '已關閉'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">您還沒有創建任何群組預約</p>
                  )}
                </div>
              </div>
          </div>
          {/* 手機版說明 */}
          <div className="sm:hidden px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg mx-3 mb-2">
            <div className="text-xs text-blue-800">
              <div className="flex items-center gap-1 mb-1">
                <span>📅</span>
                <span className="font-medium">日期說明</span>
              </div>
              <p>上方數字為日期，下方為星期。例如：<span className="font-bold">15</span> 表示 15 日，<span className="font-bold">三</span> 表示星期三</p>
            </div>
          </div>
          
          <div className="w-full overflow-x-auto">
            <div className="min-w-full">
              <div className="flex border-b border-gray-200">
                <div className="w-16 sm:w-20 bg-gray-50 border-r border-gray-200 sticky left-0 z-10"></div>
                {dateSlots.map((date, index) => (
                  <div key={index} className="flex-1 min-w-[90px] bg-gray-50 border-r border-gray-200 p-1 text-center">
                    <div className="text-xs sm:text-sm font-medium text-gray-800">
                      <div className="leading-tight">
                        <div className="font-bold">{date.getDate()}</div>
                        <div className="text-xs text-gray-600">{['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex">
                <div className="w-16 sm:w-20 border-r border-gray-200 sticky left-0 z-10 bg-white">
                  {timeSlots.map((time, index) => (
                    <div key={index} className="h-8 border-b border-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-700">{time}</span>
                    </div>
                  ))}
                </div>
                {dateSlots.map((date, dateIndex) => (
                  <div key={dateIndex} className="flex-1 min-w-[90px] border-r border-gray-200">
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
                <div className="w-4 h-4 bg-gray-500"></div>
                <span className="text-gray-600">已儲存時段（灰色）</span>
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