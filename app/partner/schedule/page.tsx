'use client'
import { useState } from 'react'
import { Calendar, dateFnsLocalizer, SlotInfo, Event } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import enUS from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'

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

export default function PartnerSchedulePage() {
  // 假設預設為沒空
  const [isAvailableNow, setIsAvailableNow] = useState(false)
  const [events, setEvents] = useState<{ title: string; start: Date; end: Date }[]>([])

  // 點選空格時新增/移除可用時段
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    const exists = events.some(e => e.start && e.end && e.start.getTime() === slotInfo.start.getTime() && e.end.getTime() === slotInfo.end.getTime())
    if (exists) {
      setEvents(events.filter(e => !(e.start && e.end && e.start.getTime() === slotInfo.start.getTime() && e.end.getTime() === slotInfo.end.getTime())))
    } else {
      setEvents([...events, { title: '可預約', start: slotInfo.start, end: slotInfo.end }])
    }
  }

  return (
    <div className="max-w-4xl mx-auto mt-16 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
      <h2 className="text-2xl font-bold mb-6 text-center">夥伴時段管理</h2>
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
      <div className="bg-white rounded shadow p-4">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView="week"
          views={['week']}
          selectable
          step={30}
          timeslots={1}
          min={new Date(2023, 0, 1, 10, 0)}
          max={new Date(2023, 0, 1, 18, 0)}
          style={{ height: 600 }}
          onSelectSlot={handleSelectSlot}
          eventPropGetter={() => ({ style: { backgroundColor: '#8b5cf6', color: 'white', borderRadius: 8 } })}
          messages={{ week: '週', day: '日', today: '今天', previous: '上週', next: '下週' }}
        />
      </div>
      <p className="text-gray-300 text-center mt-4">點選格子可切換可預約時段，之後可串接 API 儲存。</p>
    </div>
  )
} 