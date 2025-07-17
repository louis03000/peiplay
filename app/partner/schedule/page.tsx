'use client'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, SlotInfo } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import enUS from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './schedule-header-fix.css'
import './schedule-hide-gutter.css'
import { FaLock, FaCrown } from 'react-icons/fa'
import { Switch } from '@headlessui/react'

export const dynamic = 'force-dynamic'

const locales = {
  'en-US': enUS,
}
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

// 自訂 Toolbar 只顯示『今天』和『下週』
function CustomToolbar(toolbar: import('react-big-calendar').ToolbarProps<{ title: string; start: Date; end: Date }, object>) {
  return (
    <div className="rbc-toolbar flex gap-2 mb-2">
      <button type="button" onClick={() => toolbar.onNavigate('TODAY')} className="rbc-btn">今天</button>
      <button type="button" onClick={() => toolbar.onNavigate('NEXT')} className="rbc-btn">下週</button>
      <span className="ml-4 font-bold text-lg text-gray-700">{toolbar.label}</span>
    </div>
  )
}

interface PartnerImage {
  url: string;
  publicId: string;
}

export default function PartnerSchedulePage() {
  // 假設預設為沒空
  const [isAvailableNow, setIsAvailableNow] = useState(false)
  const [events, setEvents] = useState<{ title: string; start: Date; end: Date }[]>([])
  const [saveMsg, setSaveMsg] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [allSlots, setAllSlots] = useState<any[]>([])
  const [selectedSlots, setSelectedSlots] = useState<{start: Date, end: Date}[]>([])
  const [saveResult, setSaveResult] = useState<{time: string, status: string, reason: string}[] | null>(null)
  const [isRankBooster, setIsRankBooster] = useState(false)
  const [rankBoosterNote, setRankBoosterNote] = useState('')
  const [rankBoosterRank, setRankBoosterRank] = useState('')
  const [rankBoosterMsg, setRankBoosterMsg] = useState('')

  // 圖片上傳相關狀態
  const [images, setImages] = useState<PartnerImage[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [deletingImage, setDeletingImage] = useState<string | null>(null)

  // 幫助函式：判斷兩個時段是否相同
  const isSameSlot = useCallback((a: {start: Date, end: Date}, b: {start: Date, end: Date}) => {
    return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
  }, [])

  // 載入所有時段（含 booked/saved 狀態）
  useEffect(() => {
    fetch('/api/partner/schedule')
      .then(res => res.json())
      .then(data => {
        setAllSlots(data)
      })
  }, [])

  // 載入夥伴圖片
  useEffect(() => {
    fetch('/api/partner/images')
      .then(res => res.json())
      .then(data => {
        if (data.images) {
          setImages(data.images.map((url: string) => ({
            url,
            publicId: url.split('/').pop()?.split('.')[0] || ''
          })))
        }
      })
      .catch(err => console.error('載入圖片失敗:', err))
  }, [])

  // 初始化 isAvailableNow 狀態
  useEffect(() => {
    fetch('/api/partners/self')
      .then(res => res.json())
      .then(data => {
        if (data.partner && typeof data.partner.isAvailableNow === 'boolean') {
          setIsAvailableNow(data.partner.isAvailableNow)
        }
        if (data.partner && typeof data.partner.isRankBooster === 'boolean') {
          setIsRankBooster(data.partner.isRankBooster)
          setRankBoosterNote(data.partner.rankBoosterNote || '')
          setRankBoosterRank(data.partner.rankBoosterRank || '')
        }
      })
  }, [])

  // 點選空格時新增/移除可用時段（僅可選未 booked/saved 的 slot）
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    const slotStart = slotInfo.start;
    const slotEnd = slotInfo.end;
    // 檢查是否已被預約或已儲存
    const slot = allSlots.find(s => new Date(s.startTime).getTime() === slotStart.getTime() && new Date(s.endTime).getTime() === slotEnd.getTime())
    if (slot && (slot.booked || slot.saved)) return;
    setSelectedSlots(prev => {
      const exists = prev.some(e => isSameSlot(e, { start: slotStart, end: slotEnd }));
      if (exists) {
        return prev.filter(e => !isSameSlot(e, { start: slotStart, end: slotEnd }));
      } else {
        return [...prev, { start: slotStart, end: slotEnd }];
      }
    });
  }, [allSlots, isSameSlot])

  // 點選 event（已選時段）時可取消
  const handleSelectEvent = useCallback((event: any) => {
    setSelectedSlots(prev => prev.filter(e => !isSameSlot(e, { start: event.start, end: event.end })));
  }, [isSameSlot])

  // 圖片上傳處理
  const handleImageUpload = async (file: File) => {
    if (uploadingImage) return;
    
    setUploadingImage(true);
    try {
      // 創建 FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'spjt8xnd'); // 你的 Cloudinary preset
      formData.append('cloud_name', 'dbhlwvrch'); // 你的 Cloudinary cloud name

      // 上傳到 Cloudinary
      const response = await fetch(`https://api.cloudinary.com/v1_1/dbhlwvrch/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('圖片上傳失敗');
      }

      const result = await response.json();
      
      // 儲存到資料庫
      const saveResponse = await fetch('/api/partner/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: result.secure_url }),
      });

      if (!saveResponse.ok) {
        throw new Error('儲存圖片失敗');
      }

      // 更新本地狀態
      setImages(prev => [...prev, {
        url: result.secure_url,
        publicId: result.public_id
      }]);

    } catch (error) {
      console.error('上傳圖片失敗:', error);
      alert('圖片上傳失敗，請重試');
    } finally {
      setUploadingImage(false);
    }
  };

  // 刪除圖片
  const handleDeleteImage = async (imageUrl: string) => {
    if (deletingImage) return;
    
    setDeletingImage(imageUrl);
    try {
      const response = await fetch('/api/partner/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        throw new Error('刪除圖片失敗');
      }

      // 更新本地狀態
      setImages(prev => prev.filter(img => img.url !== imageUrl));

    } catch (error) {
      console.error('刪除圖片失敗:', error);
      alert('刪除圖片失敗，請重試');
    } finally {
      setDeletingImage(null);
    }
  };

  // 處理檔案選擇
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // 清空 input 值，允許重複選擇同一檔案
    event.target.value = '';
  };

  // 自訂 slot wrapper，讓空格可點擊
  const CustomSlotWrapper = useCallback((props: any) => {
    const slotStart: Date = props.value as Date;
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
    const now = new Date();
    if (
      slotStart.getHours() === 0 && slotStart.getMinutes() === 0 &&
      slotEnd.getHours() === 0 && slotEnd.getMinutes() === 0
    ) {
      return <div style={{ pointerEvents: 'none', background: '#fff' }}></div>;
    }
    if (slotEnd <= now) {
      return <div style={{ pointerEvents: 'none', background: '#fff' }}></div>;
    }
    const slot = allSlots.find(s => new Date(s.startTime).getTime() === slotStart.getTime() && new Date(s.endTime).getTime() === slotEnd.getTime())
    const isBooked = slot?.booked
    const isSaved = !!slot
    const isSelected = selectedSlots.some((e) => e.start.getTime() === slotStart.getTime() && e.end.getTime() === slotEnd.getTime());
    let bg = '#fff', color = '#222', cursor = 'pointer', icon = null, opacity = 1;
    if (isBooked) {
      bg = '#d1d5db'; color = '#888'; cursor = 'not-allowed'; icon = <FaLock style={{marginLeft:4}}/>; opacity = 0.6;
    } else if (isSaved && isSelected) {
      bg = '#ef4444'; color = '#fff'; // 紅色，代表將刪除
      cursor = 'pointer';
    } else if (isSaved) {
      bg = '#e5e7eb'; color = '#aaa'; cursor = 'pointer'; // 灰色但可點擊
    } else if (isSelected) {
      bg = '#4F46E5'; color = '#fff';
    }
    return (
      <div style={{
        height: '100%', background: bg, color, border: '1px solid #a5b4fc', borderRadius: 6,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: isSelected ? 'bold' : 'normal', fontSize: 14, cursor, transition: 'background 0.2s, color 0.2s', opacity
      }}
      onClick={() => {
        if (isBooked) return;
        setSelectedSlots(prev => {
          const exists = prev.some(e => isSameSlot(e, { start: slotStart, end: slotEnd }));
          if (exists) {
            return prev.filter(e => !isSameSlot(e, { start: slotStart, end: slotEnd }));
          } else {
            return [...prev, { start: slotStart, end: slotEnd }];
          }
        });
      }}
      >
        <span>{slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <span style={{ fontSize: 12, opacity: 0.8 }}>{'-' + slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        {icon}
      </div>
    )
  }, [allSlots, selectedSlots])

  // 自訂 event component，讓已選時段也上下排顯示
  const CustomEvent = useCallback(({ event }: { event: { start: Date; end: Date } }) => {
    const start = new Date(event.start)
    const end = new Date(event.end)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <span style={{ fontSize: 12, opacity: 0.8 }}>{'-' + end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
      </div>
    )
  }, [])

  // 使用 useMemo 優化組件配置
  const calendarComponents = useMemo(() => ({
    toolbar: CustomToolbar,
    timeSlotWrapper: CustomSlotWrapper,
  }), [CustomSlotWrapper])

  // 切換「現在有空」狀態
  const handleToggleAvailableNow = async () => {
    const next = !isAvailableNow;
    setIsAvailableNow(next)
    await fetch('/api/partners/self', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailableNow: next })
    })
  }

  // 切換「我是上分高手」狀態
  const handleToggleRankBooster = async () => {
    const next = !isRankBooster;
    setIsRankBooster(next)
    await fetch('/api/partners/self', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRankBooster: next })
    })
  }

  // 儲存上分高手資料
  const handleSaveRankBooster = async () => {
    setRankBoosterMsg('')
    const res = await fetch('/api/partners/self', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isRankBooster: true,
        rankBoosterNote,
        rankBoosterRank
      })
    })
    if (res.ok) setRankBoosterMsg('已儲存！')
    else setRankBoosterMsg('儲存失敗，請重試')
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
      <div className="w-full max-w-5xl mx-auto bg-white/10 rounded-xl p-6 md:p-8 shadow-lg backdrop-blur">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-center">夥伴時段管理</h2>
        <p className="text-center text-indigo-300 font-medium mb-6">點選下方任一格即可新增可預約時段，再點一次可取消</p>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Switch
              checked={isAvailableNow}
              onChange={handleToggleAvailableNow}
              className={`${isAvailableNow ? 'bg-green-500' : 'bg-gray-400'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
            >
              <span className="sr-only">現在有空</span>
              <span
                className={`${isAvailableNow ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
            <div className="flex flex-col items-start">
              <span className="text-indigo-300 font-medium">現在有空</span>
              <span className={`text-sm font-bold ${isAvailableNow ? 'text-green-400' : 'text-gray-400'} mt-1`}>{isAvailableNow ? '顧客可即時預約你' : '顧客看不到你'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <Switch
              checked={isRankBooster}
              onChange={handleToggleRankBooster}
              className={`${isRankBooster ? 'bg-yellow-500' : 'bg-gray-400'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
            >
              <span className="sr-only">我是上分高手</span>
              <span
                className={`${isRankBooster ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
            <div className="flex flex-col items-start">
              <span className="text-indigo-300 font-medium">我是上分高手</span>
              <span className={`text-sm font-bold ${isRankBooster ? 'text-yellow-400' : 'text-gray-400'} mt-1`}>{isRankBooster ? '顧客可搜尋上分高手' : '顧客搜尋不到你'}</span>
            </div>
          </div>
        </div>

        {/* 圖片上傳區塊 */}
        <div className="mb-8 p-6 bg-white/5 rounded-xl border border-white/10">
          <h3 className="text-lg font-bold mb-4 text-center">個人圖片管理</h3>
          <p className="text-center text-gray-300 mb-4">上傳多張圖片，讓顧客更了解你</p>
          
          {/* 圖片上傳 */}
          <div className="flex justify-center mb-4">
            <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg transition-colors">
              {uploadingImage ? '上傳中...' : '選擇圖片上傳'}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploadingImage}
              />
            </label>
          </div>

          {/* 圖片預覽 */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image.url}
                    alt={`圖片 ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleDeleteImage(image.url)}
                    disabled={deletingImage === image.url}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {deletingImage === image.url ? '...' : '×'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 上分高手專屬資料 */}
        {isRankBooster && (
          <div className="mb-8 p-6 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-4">
              <FaCrown className="text-yellow-400 text-xl" />
              <h3 className="text-lg font-bold text-yellow-400">上分高手專屬資料</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-yellow-300 font-medium mb-2">強項 (可多行描述)</label>
                <textarea
                  value={rankBoosterNote}
                  onChange={(e) => setRankBoosterNote(e.target.value)}
                  placeholder="請輸入你的遊戲強項、擅長角色、服務特色等..."
                  className="w-full p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-white placeholder-yellow-300/50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-yellow-300 font-medium mb-2">目前段位</label>
                <input
                  type="text"
                  value={rankBoosterRank}
                  onChange={(e) => setRankBoosterRank(e.target.value)}
                  placeholder="例:英雄聯盟S13大師、傳說對決 S30王者..."
                  className="w-full p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-white placeholder-yellow-300/50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div className="flex justify-center">
                <button
                  onClick={handleSaveRankBooster}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  儲存上分高手資料
                </button>
              </div>
              {rankBoosterMsg && (
                <div className="text-center text-yellow-400 font-medium">{rankBoosterMsg}</div>
              )}
            </div>
          </div>
        )}

        {/* 時段管理 */}
        <div className="mb-8">
          <div className="bg-white rounded-lg p-4 shadow-lg">
            <Calendar
              localizer={localizer}
              events={selectedSlots.map(slot => ({
                title: `${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`,
                start: slot.start,
                end: slot.end
              }))}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600, overflow: 'auto' }}
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              components={calendarComponents}
              defaultView="week"
              views={['week']}
              step={30}
              timeslots={1}
              min={new Date(0, 0, 0, 9, 0, 0)}
              max={new Date(0, 0, 0, 22, 0, 0)}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: '#4F46E5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 4px',
                  fontSize: '12px'
                }
              })}
            />
          </div>
        </div>

        {/* 儲存按鈕 */}
        <div className="text-center">
          <button
            onClick={async () => {
              if (selectedSlots.length === 0) {
                alert('請先選擇時段');
                return;
              }
              setIsSaving(true);
              setSaveMsg('');
              try {
                const schedules = selectedSlots.map(slot => ({
                  date: slot.start.toISOString().split('T')[0],
                  startTime: slot.start.toISOString(),
                  endTime: slot.end.toISOString()
                }));
                const res = await fetch('/api/partner/schedule', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(schedules)
                });
                if (res.ok) {
                  setSaveMsg('時段儲存成功！');
                  setSelectedSlots([]);
                  // 重新載入時段
                  fetch('/api/partner/schedule')
                    .then(res => res.json())
                    .then(data => setAllSlots(data));
                } else {
                  const error = await res.json();
                  setSaveMsg(`儲存失敗: ${error.error}`);
                }
              } catch (error) {
                setSaveMsg('儲存失敗，請重試');
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving || selectedSlots.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-medium transition-colors"
          >
            {isSaving ? '儲存中...' : '儲存時段'}
          </button>
          {saveMsg && (
            <div className={`mt-4 text-center font-medium ${saveMsg.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>
              {saveMsg}
            </div>
          )}
        </div>

        <div className="text-center text-gray-400 mt-4">
          點選格子可切換可預約時段，儲存後顧客就能預約你！
        </div>
      </div>
    </div>
  );
}