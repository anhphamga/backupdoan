import React, { useMemo } from 'react'

const getAssignedCount = (shift) => {
  const count = Number(shift?.assignedStaffCount)
  if (Number.isFinite(count)) return count
  if (Array.isArray(shift?.assignedStaffIds)) return shift.assignedStaffIds.length
  return 0
}

const toMinutes = (timeText) => {
  const text = String(timeText || '').trim()
  const m = /^(\d{2}):(\d{2})$/.exec(text)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

const getShiftLabel = (shift) => {
  const start = toMinutes(shift?.startTime)
  if (start == null) return 'Ca làm'
  if (start < 12 * 60) return 'Ca sáng'
  if (start < 18 * 60) return 'Ca chiều'
  return 'Ca tối'
}

const getSlotMeta = (shift) => {
  const requiredStaff = Number(shift?.requiredStaff || 0)
  const assignedCount = getAssignedCount(shift)
  const status = String(shift?.status || '').toUpperCase()

  const remaining = Math.max(requiredStaff - assignedCount, 0)
  const isClosed = status === 'CLOSED'
  const isFull = status === 'FULL' || (requiredStaff > 0 && assignedCount >= requiredStaff)

  if (isClosed) {
    return { tone: 'muted', label: 'Đã đóng', dot: 'bg-slate-400' }
  }
  if (isFull) {
    return { tone: 'danger', label: 'Đã đầy', dot: 'bg-rose-500' }
  }
  if (remaining <= 1) {
    return { tone: 'warning', label: 'Gần đầy', dot: 'bg-amber-500' }
  }
  return { tone: 'success', label: 'Còn chỗ', dot: 'bg-emerald-500' }
}

export default function ShiftCard({
  shift,
  selected = false,
  onClick,
  className = '',
  compact = false,
  rightSlot = null,
}) {
  const requiredStaff = Number(shift?.requiredStaff || 0)
  const assignedCount = getAssignedCount(shift)
  const startTime = String(shift?.startTime || '')
  const endTime = String(shift?.endTime || '')

  const label = useMemo(() => getShiftLabel(shift), [shift])
  const slotMeta = useMemo(() => getSlotMeta(shift), [shift])

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-xl border text-left transition',
        selected ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:bg-slate-50',
        compact ? 'px-3 py-2' : 'p-3',
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${slotMeta.dot}`} />
            <div className="truncate text-sm font-semibold text-slate-900">{label}</div>
          </div>
          <div className="mt-1 text-xs font-medium text-slate-600">
            {startTime && endTime ? `${startTime} - ${endTime}` : 'N/A'}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">{assignedCount}/{requiredStaff || 0}</span>
            <span className="truncate">{slotMeta.label}</span>
          </div>
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </button>
  )
}

