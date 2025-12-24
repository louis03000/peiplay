'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Switch } from '@headlessui/react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

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
  const [isSaving, setIsSaving] = useState(false); // 🛡 第一層：UI 操作鎖
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
  const [currentTime, setCurrentTime] = useState(new Date()); // 用於定期更新時間提醒
  const [scheduleUpdateKey, setScheduleUpdateKey] = useState(0); // 用於強制觸發 cellStatesMap 重新計算

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

  // 定期更新當前時間（用於顯示群組預約提醒）
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 每分鐘更新一次

    return () => clearInterval(timer);
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
      const response = await fetch('/api/partner/dashboard', {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        console.error('❌ refreshData 失敗:', response.status, response.statusText);
        return; // 失敗時不更新狀態，保留現有資料
      }
      
      const data = await response.json();
      
      // 處理數據
      if (data && data.partner) {
        console.log('✅ refreshData 成功，載入時段數量:', data.schedules?.length || 0);
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
        
        // 更新時段資料
        const newSchedules = data.schedules || [];
        console.log('🔄 refreshData 更新時段:', {
          count: newSchedules.length,
          schedules: newSchedules.slice(0, 5).map((s: Schedule) => ({
            id: s.id,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            isAvailable: s.isAvailable,
            booked: s.booked,
          })),
        });
        
        // 強制更新 schedules 狀態
        console.log('🔄 準備更新 schedules 狀態，當前數量:', schedules.length, '新數量:', newSchedules.length);
        
        // 調試：檢查新時段詳情（在更新前）- 使用 dayjs 正確轉換為台灣時區
        if (newSchedules.length > 0) {
          console.log('🔍 refreshData 收到的所有時段詳情:', newSchedules.map((s: Schedule) => {
            // 使用 dayjs 將 UTC 時間轉換為台灣時區
            const dateTaipei = dayjs.utc(s.date).tz('Asia/Taipei');
            const startTaipei = dayjs.utc(s.startTime).tz('Asia/Taipei');
            const endTaipei = dayjs.utc(s.endTime).tz('Asia/Taipei');
            return {
              id: s.id,
              dateISO: s.date,
              startTimeISO: s.startTime,
              endTimeISO: s.endTime,
              dateTaipei: dateTaipei.format('YYYY-MM-DD'),
              startTimeTaipei: startTaipei.format('HH:mm'),
              endTimeTaipei: endTaipei.format('HH:mm'),
              isAvailable: s.isAvailable,
              booked: s.booked,
            };
          }));
        }
        
        // 🛡 第三層：防止空數據覆蓋現有狀態
        // 使用函數式更新確保獲取最新狀態
        setSchedules(prevSchedules => {
          console.log('🔄 setSchedules 被調用，prev 數量:', prevSchedules.length, 'new 數量:', newSchedules.length);
          
          // 防止空數據覆蓋現有狀態（避免競態條件）
          if (newSchedules.length === 0 && prevSchedules.length > 0) {
            console.warn('⚠️ 防止用空數據覆蓋現有狀態，保留當前狀態');
            // 不更新，保留現有狀態
            return prevSchedules;
          }
          
          // 使用展開運算符確保創建新數組，觸發重新渲染
          const newState = [...newSchedules];
          console.log('✅ setSchedules 返回新狀態，數量:', newState.length);
          
          // 調試：驗證新狀態中的時段
          if (newState.length > 0) {
            console.log('🔍 setSchedules 新狀態中的前3個時段:', newState.slice(0, 3).map(s => {
              const date = new Date(s.date);
              const start = new Date(s.startTime);
              return {
                id: s.id,
                dateLocal: getLocalDateString(date),
                startTimeLocal: `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`,
              };
            }));
          }
          
          // 強制觸發 cellStatesMap 重新計算
          setScheduleUpdateKey(prev => prev + 1);
          
          return newState;
        });
        
        setMyGroups(data.groups || []);
        
        console.log('✅ schedules 狀態已更新，數量:', newSchedules.length);
        
        // 強制觸發一次重新渲染（通過更新一個不影響功能的狀態）
        // 這確保 React 會重新計算所有依賴 schedules 的 useCallback
        setSaving(prev => prev); // 觸發重新渲染
        
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

  // 取得 yyyy-mm-dd（台灣時區）- 使用useCallback優化
  const getLocalDateString = useCallback((date: Date) => {
    // ⚠️ 重要：使用台灣時區來格式化日期，確保與 schedulesTaipei 中的日期格式一致
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }, []);

  // ⚠️ 性能優化：預先將所有 schedules 轉換為台灣時區格式，避免在每次調用時重複轉換
  const schedulesTaipei = useMemo(() => {
    return schedules.map(schedule => {
      // 使用 Intl.DateTimeFormat 快速轉換為台灣時區（比 dayjs.tz 快很多）
      const scheduleStartUTC = new Date(schedule.startTime);
      const scheduleDateUTC = new Date(schedule.date);
      
      // 使用 Intl API 獲取台灣時區的時間（不創建新 Date，只格式化）
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      
      const startParts = formatter.formatToParts(scheduleStartUTC);
      const dateParts = formatter.formatToParts(scheduleDateUTC);
      
      return {
        ...schedule,
        _taipei: {
          date: `${dateParts.find(p => p.type === 'year')?.value}-${dateParts.find(p => p.type === 'month')?.value}-${dateParts.find(p => p.type === 'day')?.value}`,
          hour: parseInt(startParts.find(p => p.type === 'hour')?.value || '0'),
          minute: parseInt(startParts.find(p => p.type === 'minute')?.value || '0'),
        }
      };
    });
  }, [schedules]);

  // ⚠️ 關鍵修復：使用 UTC timestamp 精確比對，完全避免時區轉換問題
  // 核心原則：UI 是 DB 的投影，不是判斷來源
  const getScheduleAtTime = useCallback((date: Date, timeSlot: string) => {
    const dateStr = getLocalDateString(date);
    const [hour, minute] = timeSlot.split(':');
    
    // 🔪 第一刀：將前端選擇的台灣時間轉換為 UTC timestamp（只准用 number 比）
    const slotTaipeiDateTimeStr = `${dateStr} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    const slotStartUtc = dayjs.tz(slotTaipeiDateTimeStr, 'Asia/Taipei').utc().valueOf(); // UTC timestamp (毫秒)
    
    // 🔪 第二刀：先用 DB 資料決定格子狀態，再畫 UI（UI 不准自己猜）
    // 在數據庫時段中查找匹配的時段（使用 UTC timestamp 精確比對）
    const matched = schedules.find(schedule => {
      // 只准用 UTC timestamp 比對，不依賴任何字串或 local time
      const scheduleStartUtc = new Date(schedule.startTime).getTime(); // UTC timestamp (毫秒)
      
      // 允許 1 分鐘的誤差（60000 毫秒）
      const timeDiff = Math.abs(slotStartUtc - scheduleStartUtc);
      const isMatch = timeDiff <= 60000; // 1 分鐘 = 60000 毫秒
      
      // 調試：記錄比對過程（只在接近匹配時記錄）
      if (timeDiff <= 5 * 60000) { // 5 分鐘內
        console.log(`🔍 UTC timestamp 比對:`, {
          slotTaipei: slotTaipeiDateTimeStr,
          slotStartUtc: slotStartUtc,
          slotStartUtcISO: new Date(slotStartUtc).toISOString(),
          scheduleStartUtc: scheduleStartUtc,
          scheduleStartUtcISO: new Date(scheduleStartUtc).toISOString(),
          timeDiff: timeDiff,
          timeDiffMinutes: Math.round(timeDiff / 60000),
          isMatch: isMatch,
          scheduleId: schedule.id,
        });
      }
      
      return isMatch;
    });
    
    // 調試：如果沒有匹配到，記錄一下
    if (!matched && schedules.length > 0) {
      // 查找接近的時段（30 分鐘內）
      const nearbySchedules = schedules.filter(s => {
        const scheduleStartUtc = new Date(s.startTime).getTime();
        return Math.abs(slotStartUtc - scheduleStartUtc) <= 30 * 60000; // 30 分鐘內
      });
      
      if (nearbySchedules.length > 0) {
        console.log(`⚠️ 未匹配到時段: ${dateStr} ${timeSlot}`, {
          slotStartUtc: slotStartUtc,
          slotStartUtcISO: new Date(slotStartUtc).toISOString(),
          nearbySchedules: nearbySchedules.map(s => {
            const scheduleStartUtc = new Date(s.startTime).getTime();
            return {
              id: s.id,
              scheduleStartUtc: scheduleStartUtc,
              scheduleStartUtcISO: new Date(s.startTime).toISOString(),
              diff: Math.abs(slotStartUtc - scheduleStartUtc),
              diffMinutes: Math.round(Math.abs(slotStartUtc - scheduleStartUtc) / 60000),
            };
          }),
        });
      }
    }
    
    return matched ? { ...matched } : undefined;
  }, [schedules, getLocalDateString]);

  // ⚠️ 關鍵修復：預先計算所有 cell 的狀態，使用 UTC timestamp 精確比對
  // 核心原則：UI 是 DB 的投影，先用 DB 資料決定格子狀態，再畫 UI
  const cellStatesMap = useMemo(() => {
    const now = new Date();
    const map = new Map<string, CellState>();
    
    console.log('🔄 重新計算 cellStatesMap，schedules 數量:', schedules.length, 'pendingAdd 數量:', Object.keys(pendingAdd).length, 'pendingDelete 數量:', Object.keys(pendingDelete).length, 'scheduleUpdateKey:', scheduleUpdateKey);
    
    // 🔪 第一刀：先建立 DB 時段的 UTC timestamp 映射表（只准用 number 比）
    const dbSlotMap = new Map<number, Schedule>();
    schedules.forEach(schedule => {
      const scheduleStartUtc = new Date(schedule.startTime).getTime();
      dbSlotMap.set(scheduleStartUtc, schedule);
    });
    
    console.log('📊 DB 時段 UTC timestamp 映射表:', Array.from(dbSlotMap.entries()).slice(0, 5).map(([utc, s]) => ({
      utc: utc,
      utcISO: new Date(utc).toISOString(),
      id: s.id,
      booked: s.booked,
    })));
    
    let savedCount = 0;
    let emptyCount = 0;
    let toAddCount = 0;
    let bookedCount = 0;
    let toDeleteCount = 0;
    
    dateSlots.forEach(date => {
      const dateStr = getLocalDateString(date);
      timeSlots.forEach(timeSlot => {
        const [hour, minute] = timeSlot.split(':');
        const timeDate = new Date(date);
        timeDate.setHours(Number(hour), Number(minute), 0, 0);
        
        const key = `${dateStr}_${timeSlot}`;
        
        if (timeDate.getTime() <= now.getTime()) {
          map.set(key, 'past');
          return;
        }
        
        // 🔪 第二刀：先用 DB 資料決定格子狀態，再畫 UI（UI 不准自己猜）
        // 將前端選擇的台灣時間轉換為 UTC timestamp
        const slotTaipeiDateTimeStr = `${dateStr} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
        const slotStartUtc = dayjs.tz(slotTaipeiDateTimeStr, 'Asia/Taipei').utc().valueOf();
        
        // 在 DB 映射表中查找匹配的時段（允許 1 分鐘誤差）
        let matchedSchedule: Schedule | undefined = undefined;
        for (const [dbUtc, schedule] of dbSlotMap.entries()) {
          const timeDiff = Math.abs(slotStartUtc - dbUtc);
          if (timeDiff <= 60000) { // 1 分鐘 = 60000 毫秒
            matchedSchedule = schedule;
            break;
          }
        }
        
        if (matchedSchedule) {
          // 時段已存在於數據庫中（PERSISTED 狀態）
          if (matchedSchedule.booked) {
            map.set(key, 'booked');
            bookedCount++;
          } else if (pendingDelete[matchedSchedule.id]) {
            map.set(key, 'toDelete');
            toDeleteCount++;
          } else {
            map.set(key, 'saved'); // PERSISTED 狀態 → 灰色，可刪除
            savedCount++;
          }
        } else {
          // 時段不存在於數據庫中（EMPTY 狀態）
          // 如果該時段在 pendingAdd 中，顯示為待新增（SELECTING 狀態）
          // 否則顯示為空白（EMPTY 狀態）
          if (pendingAdd[key]) {
            map.set(key, 'toAdd'); // SELECTING 狀態 → 綠色
            toAddCount++;
          } else {
            map.set(key, 'empty'); // EMPTY 狀態 → 白色
            emptyCount++;
          }
        }
      });
    });
    
    console.log(`📊 cellStatesMap 統計: saved=${savedCount} (PERSISTED), empty=${emptyCount} (EMPTY), toAdd=${toAddCount} (SELECTING), booked=${bookedCount}, toDelete=${toDeleteCount}`);
    
    console.log('✅ cellStatesMap 計算完成，總共', map.size, '個 cell');
    
    // 調試：統計各種狀態的數量
    const stateCounts = {
      empty: 0,
      toAdd: 0,
      saved: 0,
      toDelete: 0,
      booked: 0,
      past: 0,
    };
    map.forEach(state => {
      if (state in stateCounts) {
        stateCounts[state as keyof typeof stateCounts]++;
      }
    });
    console.log('📊 cellStatesMap 狀態統計:', stateCounts);
    
    // 驗證：確保 PERSISTED 狀態的數量與 DB 中的時段數量一致
    if (savedCount + bookedCount + toDeleteCount !== schedules.length) {
      console.warn('⚠️ 狀態統計不一致:', {
        savedCount,
        bookedCount,
        toDeleteCount,
        totalFromStates: savedCount + bookedCount + toDeleteCount,
        schedulesCount: schedules.length,
        difference: (savedCount + bookedCount + toDeleteCount) - schedules.length,
      });
    }
    
    return map;
  }, [dateSlots, timeSlots, getLocalDateString, getScheduleAtTime, pendingDelete, pendingAdd, scheduleUpdateKey]);

  // 決定每個 cell 的狀態（從緩存的 map 中獲取）
  const getCellState = useCallback((date: Date, timeSlot: string): CellState => {
    const key = `${getLocalDateString(date)}_${timeSlot}`;
    return cellStatesMap.get(key) || 'empty';
  }, [cellStatesMap, getLocalDateString]);

  // ⚠️ 關鍵修復：點擊 cell 時，強制檢查時段是否已存在，確保狀態機正確
  const handleCellClick = useCallback((date: Date, timeSlot: string) => {
    // 🛡 第一層：儲存中禁止操作
    if (isSaving) {
      console.warn('⚠️ 儲存中，禁止點擊操作');
      return;
    }
    
    const now = new Date();
    const [hour, minute] = timeSlot.split(':');
    const timeDate = new Date(date);
    timeDate.setHours(Number(hour), Number(minute), 0, 0);
    if (timeDate.getTime() <= now.getTime()) return;
    
    const key = `${getLocalDateString(date)}_${timeSlot}`;
    const schedule = getScheduleAtTime(date, timeSlot);
    
    console.log(`🖱️ 點擊時段: ${key}`, {
      scheduleExists: !!schedule,
      scheduleId: schedule?.id,
      scheduleBooked: schedule?.booked,
      inPendingAdd: !!pendingAdd[key],
      inPendingDelete: schedule ? !!pendingDelete[schedule.id] : false,
    });
    
    // ⚠️ 關鍵修復：已存在的時段 → 強制進入「刪除模式」
    if (schedule) {
      // 時段已存在於數據庫中 → 必須是刪除模式
      if (schedule.booked) {
        console.log('⚠️ 時段已被預約，無法操作');
        return; // 已預約的時段不能操作
      }
      
      // 如果該時段在 pendingAdd 中，立即清除（因為它已經存在，不應該新增）
      if (pendingAdd[key]) {
        console.log('🔧 清除錯誤的 pendingAdd 狀態（時段已存在）');
        setPendingAdd(prev => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }
      
      // 切換刪除狀態（這是唯一正確的操作）
      if (pendingDelete[schedule.id]) {
        console.log('✅ 取消刪除標記');
        setPendingDelete(prev => {
          const copy = { ...prev };
          delete copy[schedule.id];
          return copy;
        });
      } else {
        console.log('✅ 標記為刪除');
        setPendingDelete(prev => ({ ...prev, [schedule.id]: true }));
      }
    } else {
      // 時段不存在於數據庫中 → 新增模式
      if (pendingAdd[key]) {
        console.log('✅ 取消新增標記');
        setPendingAdd(prev => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      } else {
        console.log('✅ 標記為新增');
        setPendingAdd(prev => ({ ...prev, [key]: true }));
      }
    }
  }, [getLocalDateString, getScheduleAtTime, pendingDelete, pendingAdd]);

  // 儲存所有變更
  const handleSave = async () => {
    // 🛡 第一層：UI 操作鎖 - 防止操作太快
    if (isSaving) {
      console.warn('⚠️ 儲存中，忽略重複請求');
      return;
    }
    
    console.log('🚀 handleSave 被調用');
    console.log('📊 當前狀態:', {
      pendingAddCount: Object.keys(pendingAdd).length,
      pendingDeleteCount: Object.keys(pendingDelete).length,
      pendingAddKeys: Object.keys(pendingAdd),
      pendingDeleteIds: Object.keys(pendingDelete),
      schedulesCount: schedules.length,
    });
    
    setSaving(true);
    setIsSaving(true); // 🔒 鎖定所有操作
    const addList = Object.keys(pendingAdd).map(key => {
      const [dateStr, timeSlot] = key.split('_');
      const [hour, minute] = timeSlot.split(':');
      
      // ⚠️ 前端：用戶選擇的是台灣時間，需要轉換為 UTC 後發送給 API
      // 組合台灣時間字符串：YYYY-MM-DD HH:mm
      const taipeiDateTimeStr = `${dateStr} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      
      // 將台灣時間轉換為 UTC
      const startTimeUTC = dayjs.tz(taipeiDateTimeStr, 'Asia/Taipei').utc().toDate();
      const endTimeUTC = dayjs.tz(taipeiDateTimeStr, 'Asia/Taipei').add(30, 'minute').utc().toDate();
      
      // ⚠️ 重要：date 字段應該從 UTC 時間中提取，因為台灣時間轉換為 UTC 可能會跨日
      // 例如：台灣時間 2025-12-25 00:30 = UTC 2025-12-24 16:30
      const dateUTC = dayjs.utc(startTimeUTC).format('YYYY-MM-DD');
      
      // API 層不做時區轉換，直接發送 UTC ISO 字符串
      return {
        date: dateUTC, // UTC 日期（從 startTime 提取）
        startTime: startTimeUTC.toISOString(), // UTC ISO 字符串
        endTime: endTimeUTC.toISOString() // UTC ISO 字符串
      };
    });
    const deleteList = Object.keys(pendingDelete).map(id => {
      const schedule = schedules.find(s => s.id === id);
      if (!schedule) {
        console.warn('⚠️ 找不到要刪除的時段:', id);
        return null;
      }
      if (!schedule.date || !schedule.startTime || !schedule.endTime) {
        console.error('❌ 時段數據不完整:', { id, schedule });
        return null;
      }
      
      // ⚠️ 確保所有字段都是正確的 ISO 字符串格式（UTC）
      // schedule.date 可能是 Date 對象或 ISO 字符串
      // 如果是字符串，需要確保是完整的 ISO 格式（包含時間部分）
      let dateStr: string;
      if (typeof schedule.date === 'string') {
        // 如果是字符串，檢查是否已經是 ISO 格式
        if (schedule.date.includes('T')) {
          dateStr = schedule.date;
        } else {
          // 如果是 "YYYY-MM-DD" 格式，轉換為 ISO 格式（UTC 00:00:00）
          dateStr = new Date(`${schedule.date}T00:00:00.000Z`).toISOString();
        }
      } else {
        // 如果是 Date 對象，轉換為 ISO 字符串
        dateStr = new Date(schedule.date).toISOString();
      }
      
      // startTime 和 endTime 應該已經是 ISO 字符串格式
      const startTimeStr = typeof schedule.startTime === 'string' 
        ? schedule.startTime 
        : new Date(schedule.startTime).toISOString();
      const endTimeStr = typeof schedule.endTime === 'string' 
        ? schedule.endTime 
        : new Date(schedule.endTime).toISOString();
      
      console.log('🗑️ 準備刪除的時段:', {
        id: schedule.id,
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
      });
      
      return {
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr
      };
    }).filter(Boolean);
    
    console.log('🗑️ 準備刪除的時段列表:', deleteList);
    try {
      console.log('💾 開始儲存時段:', { addCount: addList.length, deleteCount: deleteList.length });
      
      if (addList.length > 0) {
        // 🔪 第三刀：禁止 PERSISTED 進 POST（應該進 DELETE）
        // 在發送前再次檢查，確保沒有已存在的時段被誤送
        const validatedAddList = addList.filter(addItem => {
          // 檢查這個時段是否已經存在於 schedules 中
          const slotStartUtc = new Date(addItem.startTime).getTime();
          const exists = schedules.some(s => {
            const scheduleStartUtc = new Date(s.startTime).getTime();
            return Math.abs(slotStartUtc - scheduleStartUtc) <= 60000; // 1 分鐘誤差
          });
          
          if (exists) {
            console.warn('⚠️ 阻止已存在時段進入 POST:', {
              addItem,
              reason: '該時段已存在於 DB，應該使用 DELETE 而不是 POST',
            });
          }
          
          return !exists; // 只保留不存在的時段
        });
        
        if (validatedAddList.length === 0) {
          console.warn('⚠️ 所有待新增時段都已存在，跳過 POST 請求');
          // 清除 pendingAdd 並刷新數據
          setPendingAdd({});
          await refreshData();
          // 不顯示 alert，只刷新數據讓用戶看到灰色時段
          setSaving(false);
          setIsSaving(false); // 🔓 解鎖所有操作
          return;
        }
        
        if (validatedAddList.length < addList.length) {
          console.warn(`⚠️ 過濾掉 ${addList.length - validatedAddList.length} 個已存在的時段`);
        }
        
        console.log('📤 發送新增請求:', validatedAddList);
        const addResponse = await fetch('/api/partner/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validatedAddList.length === 1 ? validatedAddList[0] : validatedAddList)
        });
        
        const addResult = await addResponse.json().catch(() => ({}));
        console.log('📥 新增響應:', { status: addResponse.status, ok: addResponse.ok, result: addResult });
        
        if (!addResponse.ok) {
          // 如果是409衝突錯誤，需要重新獲取已保存的時段，並清除衝突時段的pendingAdd狀態
          if (addResponse.status === 409) {
            console.log('⚠️ 檢測到時段衝突，重新獲取已保存的時段...');
            
            // 直接調用 /api/partner/schedule GET 端點獲取最新的時段數據
            try {
              const scheduleResponse = await fetch('/api/partner/schedule', {
                method: 'GET',
                cache: 'no-store',
              });
              
              if (scheduleResponse.ok) {
                const latestSchedules = await scheduleResponse.json();
                console.log('✅ 獲取到最新的時段數據，數量:', latestSchedules.length);
                
                // 調試：檢查獲取到的時段詳情
                if (latestSchedules.length > 0) {
                  console.log('🔍 衝突後獲取的時段詳情（前3個）:', latestSchedules.slice(0, 3).map((s: Schedule) => {
                    const dateTaipei = dayjs.utc(s.date).tz('Asia/Taipei');
                    const startTaipei = dayjs.utc(s.startTime).tz('Asia/Taipei');
                    return {
                      id: s.id,
                      dateTaipei: dateTaipei.format('YYYY-MM-DD'),
                      startTimeTaipei: startTaipei.format('HH:mm'),
                      booked: s.booked,
                    };
                  }));
                }
                
                // 清除所有pendingAdd狀態（因為衝突的時段已經存在，應該顯示為灰色）
                // 這樣用戶就能看到哪些時段已經存在，並可以點擊它們來刪除
                setPendingAdd({});
                
                // 更新 schedules 狀態（使用函數式更新確保正確）
                setSchedules(prev => {
                  console.log('🔄 衝突後更新 schedules，prev 數量:', prev.length, 'new 數量:', latestSchedules.length);
                  // 確保返回新數組引用，觸發重新渲染
                  const newSchedules = latestSchedules.map((s: Schedule) => ({ ...s }));
                  console.log('✅ 返回新 schedules 數組，數量:', newSchedules.length);
                  return newSchedules;
                });
                
                // 強制觸發 cellStatesMap 重新計算（先觸發一次）
                setScheduleUpdateKey(prev => prev + 1);
                
                // 等待 React 狀態更新完成
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 再次觸發，確保 cellStatesMap 重新計算
                setScheduleUpdateKey(prev => prev + 1);
                
                // 再等待一個 tick
                await new Promise(resolve => setTimeout(resolve, 100));
                
                console.log('✅ 衝突處理完成，schedules 已更新，cellStatesMap 已強制重新計算');
              } else {
                console.error('❌ 獲取時段數據失敗:', scheduleResponse.status);
                // 如果獲取失敗，仍然清除 pendingAdd 並刷新數據
                setPendingAdd({});
                await refreshData();
              }
            } catch (fetchError) {
              console.error('❌ 獲取時段數據時發生錯誤:', fetchError);
              // 如果獲取失敗，仍然清除 pendingAdd 並刷新數據
              setPendingAdd({});
              await refreshData();
            }
            
            // 確保在所有情況下都解鎖
            setIsSaving(false); // 🔓 解鎖所有操作
            
          // 不顯示 alert，只刷新數據讓用戶看到灰色時段
          // 不拋出錯誤，讓用戶可以看到已保存的時段
          // 但也不繼續執行後續的刪除操作，因為新增失敗了
          setSaving(false);
          setIsSaving(false); // 🔓 解鎖所有操作
          return;
          }
          
          throw new Error(addResult.error || `新增時段失敗 (${addResponse.status})`);
        }
        
        const createdCount = addResult.count !== undefined ? addResult.count : (addResult.success ? 1 : 0);
        console.log('✅ 新增成功，創建數量:', createdCount, '請求數量:', addList.length);
        
        // 如果創建數量為 0，但請求數量 > 0，表示所有時段都被跳過（可能是重複）
        if (createdCount === 0 && addList.length > 0) {
          console.warn('⚠️ 所有時段都被跳過（可能是重複）');
          // 重新獲取已保存的時段，清除pendingAdd狀態
          await refreshData();
          setPendingAdd({});
          // 不顯示 alert，只刷新數據讓用戶看到灰色時段
          setSaving(false);
          setIsSaving(false); // 🔓 解鎖所有操作
          return;
        }
      }
      
      if (deleteList.length > 0) {
        console.log('📤 發送刪除請求:', deleteList);
        const deleteResponse = await fetch('/api/partner/schedule', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deleteList)
        });
        
        const deleteResult = await deleteResponse.json().catch(() => ({}));
        console.log('📥 刪除響應:', { status: deleteResponse.status, ok: deleteResponse.ok, result: deleteResult });
        
        if (!deleteResponse.ok) {
          // 如果是 409 衝突（已被預約），不顯示 alert，只刷新數據
          if (deleteResponse.status === 409) {
            console.warn('⚠️ 時段已被預約，無法刪除');
            // 不拋出錯誤，讓用戶可以繼續操作其他時段
            // 但需要刷新數據以更新狀態
            await refreshData();
            setSaving(false);
            setIsSaving(false); // 🔓 解鎖所有操作
            return;
          }
          
          // 如果是 400 錯誤，可能是數據格式問題
          if (deleteResponse.status === 400) {
            console.error('❌ 刪除請求格式錯誤:', deleteResult);
            throw new Error(deleteResult.error || `刪除時段失敗：請求格式錯誤 (${deleteResponse.status})`);
          }
          
          throw new Error(deleteResult.error || `刪除時段失敗 (${deleteResponse.status})`);
        }
        
        console.log('✅ 刪除成功，刪除數量:', deleteResult.count || 0);
      }
      
      // 🛡 第二層：POST 成功後強制 GET 最新數據（以 DB 為準）
      console.log('🔄 清空 pending 狀態並刷新資料...');
      
      // 先清空 pending 狀態
      setPendingAdd({});
      setPendingDelete({});
      
      // 🛡 關鍵：POST 成功後，強制重新獲取最新數據（不依賴 POST 返回的數據）
      console.log('🔄 強制重新獲取最新時段數據（以 DB 為準）...');
      try {
        const freshResponse = await fetch('/api/partner/schedule', {
          method: 'GET',
          cache: 'no-store', // 強制不使用緩存
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        if (freshResponse.ok) {
          const freshSchedules = await freshResponse.json();
          console.log('✅ 獲取到最新時段數據，數量:', freshSchedules.length);
          
          // 🛡 第三層：防止空數據覆蓋現有狀態
          if (freshSchedules.length === 0 && schedules.length > 0) {
            console.warn('⚠️ 防止用空數據覆蓋現有狀態，保留當前狀態');
            // 不更新，保留現有狀態
          } else {
            // 更新 schedules 狀態（使用函數式更新確保正確）
            setSchedules(prev => {
              console.log('🔄 更新 schedules，prev 數量:', prev.length, 'fresh 數量:', freshSchedules.length);
              // 確保返回新數組引用，觸發重新渲染
              const newSchedules = freshSchedules.map((s: Schedule) => ({ ...s }));
              console.log('✅ 返回新 schedules 數組，數量:', newSchedules.length);
              return newSchedules;
            });
            
            // 強制觸發 cellStatesMap 重新計算
            setScheduleUpdateKey(prev => prev + 1);
          }
        } else {
          console.error('❌ 獲取最新數據失敗，使用 refreshData');
          await refreshData();
        }
      } catch (fetchError) {
        console.error('❌ 獲取最新數據時發生錯誤，使用 refreshData:', fetchError);
        await refreshData();
      }
      
      console.log('✅ 資料刷新完成');
      
      // 等待一個 tick 確保 React 狀態更新完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 顯示成功提示
      console.log('✅ 儲存完成，顯示成功提示');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      // 強制觸發重新渲染（通過更新一個不影響功能的狀態）
      // 這確保 React 會重新計算所有依賴 schedules 的 useCallback
      setSaving(false);
      setIsSaving(false); // 🔓 解鎖所有操作
      
      // 可選：自動滾到頂部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error('❌ 儲存時段失敗:', e);
      // 不顯示 alert，只在控制台記錄錯誤
      // 失敗時不刷新資料，保留 pending 狀態，讓用戶可以重試
      setIsSaving(false); // 🔓 解鎖所有操作（即使失敗也要解鎖）
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
                      {myGroups.map((group) => {
                        // 計算距離開始時間還有多久（使用 currentTime 確保即時更新）
                        const startTime = new Date(group.startTime);
                        const timeUntilStart = startTime.getTime() - currentTime.getTime();
                        const minutesUntilStart = Math.floor(timeUntilStart / (1000 * 60));
                        const isWithin30Minutes = minutesUntilStart > 0 && minutesUntilStart <= 30;
                        
                        return (
                          <div key={group.id} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900">{group.title}</h5>
                                {group.description && (
                                  <p className="text-sm text-gray-600">{group.description}</p>
                                )}
                                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                  <span>📅 {new Date(group.startTime).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}</span>
                                  <span>⏰ {new Date(group.startTime).toLocaleTimeString('zh-TW', { 
                                    timeZone: 'Asia/Taipei',
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: false 
                                  })} - {new Date(group.endTime).toLocaleTimeString('zh-TW', { 
                                    timeZone: 'Asia/Taipei',
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: false 
                                  })}</span>
                                  <span>💰 ${group.pricePerPerson}/人</span>
                                  <span>👥 {group.currentParticipants}/{group.maxParticipants} 人</span>
                                </div>
                                {/* 提醒訊息：時間剩下半小時 */}
                                {isWithin30Minutes && group.status === 'ACTIVE' && (
                                  <div className="mt-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-xs text-yellow-800">
                                      ⚠️ <span className="font-medium">提醒：</span>時間剩下 {minutesUntilStart} 分鐘，群組預約將自動關閉，系統將開始總結總人數，並開啟 Discord 頻道。
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="flex space-x-2 ml-4">
                                <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
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
                        );
                      })}
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
                {dateSlots.map((date) => {
                  const dateKey = getLocalDateString(date);
                  return (
                    <div key={dateKey} className="flex-1 min-w-[90px] bg-gray-50 border-r border-gray-200 p-1 text-center">
                      <div className="text-xs sm:text-sm font-medium text-gray-800">
                        <div className="leading-tight">
                          <div className="font-bold">{date.getDate()}</div>
                          <div className="text-xs text-gray-600">{['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex">
                <div className="w-16 sm:w-20 border-r border-gray-200 sticky left-0 z-10 bg-white">
                  {timeSlots.map((time) => (
                    <div key={time} className="h-8 border-b border-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-700">{time}</span>
                    </div>
                  ))}
                </div>
                {dateSlots.map((date) => {
                  const dateKey = getLocalDateString(date);
                  return (
                    <div key={dateKey} className="flex-1 min-w-[90px] border-r border-gray-200">
                      {timeSlots.map((time) => {
                        const cellKey = `${dateKey}_${time}`;
                        const state = getCellState(date, time);
                        return (
                          <div
                            key={cellKey}
                            className={`h-8 border-b border-gray-100 transition-colors ${getCellStyle(state)}`}
                            onClick={() => !isSaving && ['empty', 'toAdd', 'saved', 'toDelete'].includes(state) && handleCellClick(date, time)}
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
                  );
                })}
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
              onClick={(e) => {
                console.log('🖱️ 按鈕被點擊！', {
                  saving,
                  pendingAddCount: Object.keys(pendingAdd).length,
                  pendingDeleteCount: Object.keys(pendingDelete).length,
                  isDisabled: saving || (Object.keys(pendingAdd).length === 0 && Object.keys(pendingDelete).length === 0),
                });
                if (!saving && (Object.keys(pendingAdd).length > 0 || Object.keys(pendingDelete).length > 0)) {
                  handleSave();
                } else {
                  console.warn('⚠️ 按鈕被禁用或沒有待保存的變更');
                }
              }}
              disabled={saving || isSaving || (Object.keys(pendingAdd).length === 0 && Object.keys(pendingDelete).length === 0)}
            >
              {saving ? '儲存中...' : '儲存時段'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}