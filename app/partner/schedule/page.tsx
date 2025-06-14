'use client'
import { useState } from 'react'
import { Calendar, dateFnsLocalizer, SlotInfo, Event, ToolbarProps } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import enUS from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './schedule-header-fix.css'
import './schedule-hide-gutter.css'

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

  // 幫助函式：判斷兩個時段是否相同
  function isSameSlot(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
    return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
  }

  // 點選空格時新增/移除可用時段（自動去重）
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    const slotStart = slotInfo.start;
    const slotEnd = slotInfo.end;
    setEvents(prev => {
      const exists = prev.some(e => isSameSlot(e, { start: slotStart, end: slotEnd }));
      if (exists) {
        return prev.filter(e => !isSameSlot(e, { start: slotStart, end: slotEnd }));
      } else {
        // 新增時自動去重
        return [...prev.filter((e, i, arr) => arr.findIndex(x => isSameSlot(x, e)) === i), { title: '可預約', start: slotStart, end: slotEnd }];
      }
    });
  }

  // 點選 event（已選時段）時可取消
  const handleSelectEvent = (event: { start: Date; end: Date }) => {
    setEvents(prev => prev.filter(e => !isSameSlot(e, event)))
  }

  // 儲存所有時段到後端（自動去重）
  const handleSave = async () => {
    setSaveMsg('')
    // 去重
    const uniqueEvents = events.filter((e, i, arr) => arr.findIndex(x => isSameSlot(x, e)) === i);
    let success = 0, fail = 0
    for (const e of uniqueEvents) {
      const res = await fetch('/api/partner/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: e.start,
          startTime: e.start,
          endTime: e.end,
        })
      })
      if (res.ok) success++
      else fail++
    }
    if (success && !fail) setSaveMsg('所有時段已成功儲存！')
    else if (success && fail) setSaveMsg(`部分成功：${success} 筆成功，${fail} 筆失敗`)
    else setSaveMsg('儲存失敗，請重試')
  }

  // eventPropGetter 根據是否被選中改變底色
  const eventPropGetter = (event: { start: Date; end: Date }) => {
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
  }

  // 自訂 SlotWrapper，讓每個格子都顯示時間（移到 component 內部）
  const CustomSlotWrapper = (props: any) => {
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
    // 檢查這個 slot 是否已被選為 event
    const isSelected = events.some((e) => e.start.getTime() === slotStart.getTime() && e.end.getTime() === slotEnd.getTime());
    return (
      <div style={{
        height: '100%',
        background: isSelected ? '#4F46E5' : '#fff',
        color: isSelected ? '#fff' : '#222',
        border: '1px solid #a5b4fc',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: isSelected ? 'bold' : 'normal',
        fontSize: 14,
        cursor: 'pointer',
        transition: 'background 0.2s, color 0.2s',
      }}>
        <span>{slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <span style={{ fontSize: 12, opacity: 0.8 }}>{'-' + slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
      </div>
    )
  }

  // 自訂 event component，讓已選時段也上下排顯示
  const CustomEvent = ({ event }: { event: { start: Date; end: Date } }) => {
    const start = new Date(event.start)
    const end = new Date(event.end)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <span style={{ fontSize: 12, opacity: 0.8 }}>{'-' + end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto mt-16 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
      <h2 className="text-2xl font-bold mb-6 text-center">夥伴時段管理</h2>
      <div className="text-center text-indigo-400 font-bold mb-2">點選下方任一格即可新增可預約時段，再點一次可取消</div>
      <div className="flex items-center justify-center mb-8">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <span className={`w-3 h-3 rounded-full ${isAvailableNow ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></span>
          <span className="text-white text-lg font-medium">現在有空</span>
          <input
            type="checkbox"
            checked={isAvailableNow}
            onChange={e => setIsAvailableNow(e.target.checked)}
            className="accent-green-500 w-6 h-6"
          />
        </label>
        <span className={`ml-4 text-sm font-bold ${isAvailableNow ? 'text-green-400' : 'text-gray-400'}`}>{isAvailableNow ? '顧客可即時預約你' : '顧客看不到你'}</span>
      </div>
      <div className="bg-white rounded shadow p-4" style={{ minWidth: 900, maxWidth: 1200, margin: '0 auto', borderRadius: 16, boxShadow: '0 4px 24px #6366f133', overflow: 'auto', width: '100%' }}>
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
          messages={{ week: '週', day: '日', today: '今天', previous: '', next: '下週' }}
          components={{
            toolbar: CustomToolbar,
            timeSlotWrapper: (props: any) => {
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
              const isSelected = events.some((e) => e.start.getTime() === slotStart.getTime() && e.end.getTime() === slotEnd.getTime());
              return (
                <div style={{
                  height: '100%',
                  background: isSelected ? '#4F46E5' : '#fff',
                  color: isSelected ? '#fff' : '#222',
                  border: '1px solid #a5b4fc',
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                }}>
                  <span>{slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>{'-' + slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                </div>
              )
            },
          }}
        />
      </div>
      <button
        className="mt-6 w-full py-2 rounded bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-lg"
        onClick={handleSave}
        disabled={events.length === 0}
      >
        儲存時段
      </button>
      {saveMsg && <p className="text-center text-green-400 font-bold mt-2">{saveMsg}</p>}
      <p className="text-gray-300 text-center mt-4">點選格子可切換可預約時段，儲存後顧客就能預約你！</p>
    </div>
  )
} 