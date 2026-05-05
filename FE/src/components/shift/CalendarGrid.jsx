import React, { useMemo } from 'react'
import ShiftCard from './ShiftCard'

const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const toDateKey = (value) => {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatDayTitle = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export default function CalendarGrid({
  weekDates = [],
  shiftsByDate = {},
  selectedDate = '',
  selectedShiftId = '',
  onSelectDate,
  onSelectShift,
  emptyHint = 'Chưa có ca trong tuần này.',
}) {
  const normalizedWeekDates = useMemo(() => {
    return weekDates.map((d) => (d instanceof Date ? d : new Date(d))).filter((d) => !Number.isNaN(d.getTime()))
  }, [weekDates])

  const columns = useMemo(() => {
    return normalizedWeekDates.map((d, idx) => {
      const key = toDateKey(d)
      const items = Array.isArray(shiftsByDate?.[key]) ? shiftsByDate[key] : []
      return {
        date: d,
        key,
        weekday: weekdayLabels[idx] || '',
        title: formatDayTitle(d),
        items: [...items].sort((a, b) => String(a?.startTime || '').localeCompare(String(b?.startTime || ''))),
      }
    })
  }, [normalizedWeekDates, shiftsByDate])

  const total = useMemo(() => columns.reduce((sum, c) => sum + c.items.length, 0), [columns])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {total === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          {emptyHint}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {columns.map((col) => {
          const isSelectedDay = col.key === selectedDate
          return (
            <div
              key={col.key}
              className={[
                'rounded-2xl border p-2 transition',
                isSelectedDay ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white hover:bg-slate-50/60',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => onSelectDate?.(col.key)}
                className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left hover:bg-white/70"
              >
                <div className="text-xs font-semibold text-slate-700">{col.weekday}</div>
                <div className="text-xs font-semibold text-slate-700">{col.title}</div>
              </button>

              <div className="mt-2 space-y-2">
                {col.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
                    Không có ca
                  </div>
                ) : (
                  col.items.map((shift) => {
                    const shiftId = String(shift?._id || '')
                    const selected = isSelectedDay && shiftId && shiftId === selectedShiftId
                    return (
                      <ShiftCard
                        key={shiftId || `${col.key}:${shift?.startTime}-${shift?.endTime}`}
                        shift={shift}
                        compact
                        selected={selected}
                        onClick={() => {
                          onSelectDate?.(col.key)
                          onSelectShift?.(shift, col.key)
                        }}
                      />
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

