'use client'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, SlotInfo, Event, ToolbarProps } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import enUS from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './schedule-header-fix.css'
import './schedule-hide-gutter.css'
import { FaLock } from 'react-icons/fa'
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

export default function PartnerSchedulePage() {
  // 假設預設為沒空
  const [isAvailableNow, setIsAvailableNow] = useState(false)
  const [events, setEvents] = useState<{ title: string; start: Date; end: Date }[]>([])
  const [saveMsg, setSaveMsg] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [allSlots, setAllSlots] = useState<any[]>([])
  const [selectedSlots, setSelectedSlots] = useState<{start: Date, end: Date}[]>([])
  const [saveResult, setSaveResult] = useState<{time: string, status: string, reason: string}[] | null>(null)

  // 幫助函式：判斷兩個時段是否相同
  const isSameSlot = useCallback((a: { start: Date; end: Date }, b: { start: Date; end: Date }) => {
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

  // 初始化 isAvailableNow 狀態
  useEffect(() => {
    fetch('/api/partners/self')
      .then(res => res.json())
      .then(data => {
        if (data.partner && typeof data.partner.isAvailableNow === 'boolean') {
          setIsAvailableNow(data.partner.isAvailableNow)
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
  const handleSelectEvent = useCallback((event: { start: Date; end: Date }) => {
    setEvents(prev => prev.filter(e => !isSameSlot(e, event)))
  }, [isSameSlot])

  // 儲存所有時段到後端（批量處理）
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true)
    setSaveMsg('')
    setSaveResult(null)
    try {
      const uniqueEvents = selectedSlots.filter((e, i, arr) => arr.findIndex(x => isSameSlot(x, e)) === i);
      if (uniqueEvents.length === 0) {
        setSaveMsg('沒有可儲存的時段')
        return
      }
      const scheduleData = uniqueEvents.map(e => ({ date: e.start, startTime: e.start, endTime: e.end }))
      const res = await fetch('/api/partner/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scheduleData)
      })
      if (!res.ok) throw new Error('儲存失敗')
      const result = await res.json()
      if (result.success) {
        setSaveResult([
          ...result.details.createdSchedules.map((s: any) => ({
            time: `${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}-${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`,
            status: '成功', reason: ''
          })),
          ...result.details.errors.map((e: any) => ({
            time: `${new Date(e.schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}-${new Date(e.schedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`,
            status: '失敗', reason: e.error
          }))
        ])
        // 重新載入所有時段，讓已儲存的 slot 變灰
        fetch('/api/partner/schedule').then(res => res.json()).then(data => setAllSlots(data))
        setSelectedSlots([])
        setSaveMsg(result.errors === 0 ? `所有時段已成功儲存！共 ${result.created} 筆` : `部分成功：${result.created} 筆成功，${result.errors} 筆失敗`)
      } else {
        setSaveMsg('儲存失敗，請重試')
      }
    } catch (error) {
      setSaveMsg('儲存失敗，請重試')
    } finally {
      setIsSaving(false)
    }
  }, [selectedSlots, isSaving, isSameSlot])

  // eventPropGetter 根據是否被選中改變底色
  const eventPropGetter = useCallback((event: { start: Date; end: Date }) => {
    const isSelected = events.some(e => isSameSlot(e, event));
    return {
      style: {
        backgroundColor: isSelected ? '#4F46E5' : '#a5b4fc', // 選中主色，未選淡色
        color: '#fff',
        borderRadius: 8,
        border: isSelected ? '2px solid #6366f1' : '2px solid #a5b4fc',
        fontWeight: 'bold',
        fontSize: 16,
        boxShadow: isSelected ? '0 2px 8px #6366f133' : 'none',
        zIndex: isSelected ? 2 : 1,
      }
    }
  }, [events, isSameSlot])

  // SlotWrapper 根據 slot 狀態渲染
  const CustomSlotWrapper = useCallback((props: any) => {
    const slotStart: Date = props.value as Date;
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
    const now = new Date();
    // 過濾掉 00:00~00:00（上午12:00-上午12:00）這一行
    if (
      slotStart.getHours() === 0 && slotStart.getMinutes() === 0 &&
      slotEnd.getHours() === 0 && slotEnd.getMinutes() === 0
    ) {
      return <div style={{ pointerEvents: 'none', background: '#fff' }}></div>;
    }
    // 只顯示現在時間之後的時段
    if (slotEnd <= now) {
      return <div style={{ pointerEvents: 'none', background: '#fff' }}></div>;
    }
    // 檢查 slot 狀態
    const slot = allSlots.find(s => new Date(s.startTime).getTime() === slotStart.getTime() && new Date(s.endTime).getTime() === slotEnd.getTime())
    const isBooked = slot?.booked
    const isSaved = !!slot
    const isSelected = selectedSlots.some((e) => e.start.getTime() === slotStart.getTime() && e.end.getTime() === slotEnd.getTime());
    let bg = '#fff', color = '#222', cursor = 'pointer', icon = null;
    if (isBooked) {
      bg = '#d1d5db'; color = '#888'; cursor = 'not-allowed'; icon = <FaLock style={{marginLeft:4}}/>;
    } else if (isSaved) {
      bg = '#e5e7eb'; color = '#aaa'; cursor = 'not-allowed';
    } else if (isSelected) {
      bg = '#4F46E5'; color = '#fff';
    }
    return (
      <div style={{
        height: '100%', background: bg, color, border: '1px solid #a5b4fc', borderRadius: 6,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: isSelected ? 'bold' : 'normal', fontSize: 14, cursor, transition: 'background 0.2s, color 0.2s', opacity: isBooked || isSaved ? 0.6 : 1
      }}>
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

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
      <div className="w-full max-w-5xl mx-auto bg-white/10 rounded-xl p-6 md:p-8 shadow-lg backdrop-blur">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-center">夥伴時段管理</h2>
        <p className="text-center text-indigo-300 font-medium mb-6">點選下方任一格即可新增可預約時段，再點一次可取消</p>
        
        <div className="flex items-center justify-center mb-8">
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
            <span className="text-gray-700 font-medium">現在有空</span>
          </div>
          <span className={`ml-4 text-sm font-bold ${isAvailableNow ? 'text-green-400' : 'text-gray-400'}`}>{isAvailableNow ? '顧客可即時預約你' : '顧客看不到你'}</span>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 overflow-x-auto">
          <div style={{ minWidth: '800px' }}> {/*
            Ensures the calendar has enough space on smaller screens when scrolling
          */}
            <Calendar
              localizer={localizer}
              events={[]}
              startAccessor="start"
              endAccessor="end"
              defaultView="week"
              views={['week']}
              selectable
              step={30}
              timeslots={1}
              min={new Date(2023, 0, 1, 0, 0)}
              max={new Date(2023, 0, 1, 23, 30)}
              style={{ height: 600 }}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              messages={{ week: '週', day: '日', today: '今天', previous: '', next: '下週' }}
              components={calendarComponents}
            />
          </div>
        </div>
        
        <button
          className="mt-8 w-full py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-lg hover:from-indigo-600 hover:to-purple-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSave}
          disabled={selectedSlots.length === 0 || isSaving}
        >
          {isSaving ? '儲存中...' : '儲存時段'}
        </button>
        {saveMsg && <p className="text-center text-green-400 font-bold mt-4">{saveMsg}</p>}
        {saveResult && (
          <div className="mt-4 bg-gray-800 rounded-lg p-4 text-sm">
            <div className="mb-2 font-bold">儲存結果：</div>
            {saveResult.map((r: {time: string, status: string, reason: string}, i: number) => (
              <div key={i} className={r.status === '成功' ? 'text-green-400' : 'text-red-400'}>
                {r.time}：{r.status}{r.reason && `（${r.reason}）`}
              </div>
            ))}
          </div>
        )}
        <p className="text-gray-400 text-center mt-4 text-sm">點選格子可切換可預約時段，儲存後顧客就能預約你！</p>
      </div>
    </div>
  )
}