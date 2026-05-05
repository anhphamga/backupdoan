import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useShiftSchedules } from '../../hooks/useShiftSchedules'
import CalendarGrid from '../../components/shift/CalendarGrid'
import ShiftDetailDrawer from '../../components/shift/ShiftDetailDrawer'
import ShiftCard from '../../components/shift/ShiftCard'

const todayInput = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const toDateKey = (value) => {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const addDays = (date, days) => {
  const d = date instanceof Date ? new Date(date) : new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const getWeekStartMonday = (dateKey) => {
  const d = new Date(dateKey)
  if (Number.isNaN(d.getTime())) return new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(d, diff)
}

const formatWeekRange = (weekStartDate) => {
  const start = weekStartDate instanceof Date ? weekStartDate : new Date(weekStartDate)
  const end = addDays(start, 6)
  return `${start.toLocaleDateString('vi-VN')} - ${end.toLocaleDateString('vi-VN')}`
}

const getAssignedCount = (shift) => {
  const count = Number(shift?.assignedStaffCount)
  if (Number.isFinite(count)) return count
  if (Array.isArray(shift?.assignedStaffIds)) return shift.assignedStaffIds.length
  return 0
}

const CHECKIN_EARLY_MINUTES = Math.max(Number(import.meta.env.VITE_SHIFT_CHECKIN_EARLY_MINUTES || 15), 0)
// Không giới hạn check-out sớm theo yêu cầu nghiệp vụ hiện tại

const parseTimeToMinutes = (timeText) => {
  const text = String(timeText || '').trim()
  const m = /^(\d{2}):(\d{2})$/.exec(text)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

const isOverlap = (startA, endA, startB, endB) => startA < endB && startB < endA

const buildShiftDateTime = (dateValue, timeText) => {
  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  const minutes = parseTimeToMinutes(timeText)
  if (minutes == null) return null
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

const isShiftFullOrClosed = (shift) => {
  const status = String(shift?.status || '').toUpperCase()
  if (status === 'CLOSED' || status === 'FULL') return true
  const required = Number(shift?.requiredStaff || 0)
  const assigned = getAssignedCount(shift)
  return required > 0 && assigned >= required
}

export default function StaffSchedulesPage() {
  const {
    selectedDate,
    setSelectedDate,
    error,
    actionLoadingMap,
    fetchShifts,
    fetchMyRegistrations,
    registerShift,
    checkIn,
    checkOut,
    undoCheckOut,
    currentShift,
    refresh,
  } = useShiftSchedules({ initialDate: todayInput() })

  const [toast, setToast] = useState('')
  const [weekLoading, setWeekLoading] = useState(false)
  const [weekShiftsByDate, setWeekShiftsByDate] = useState({})
  const [weekRegistrationByShiftId, setWeekRegistrationByShiftId] = useState({})
  const [selectedShift, setSelectedShift] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    if (!msg) return
    setTimeout(() => setToast(''), 3500)
  }

  const weekStart = useMemo(() => getWeekStartMonday(selectedDate), [selectedDate])
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const selectedShiftId = String(selectedShift?._id || '')

  const loadWeek = useCallback(async () => {
    setWeekLoading(true)
    try {
      const dateKeys = weekDates.map((d) => toDateKey(d)).filter(Boolean)
      const results = await Promise.all(dateKeys.map((key) => fetchShifts(key, { silent: true })))
      const next = {}
      for (let i = 0; i < dateKeys.length; i += 1) next[dateKeys[i]] = Array.isArray(results[i]) ? results[i] : []
      setWeekShiftsByDate(next)
    } finally {
      setWeekLoading(false)
    }
  }, [fetchShifts, weekDates])

  const loadWeekRegistrations = useCallback(async () => {
    const dateKeys = weekDates.map((d) => toDateKey(d)).filter(Boolean)
    const results = await Promise.all(dateKeys.map((key) => fetchMyRegistrations(key, { silent: true })))
    const map = {}
    for (const items of results) {
      if (!Array.isArray(items)) continue
      for (const reg of items) {
        const shiftId = String(reg?.shiftId?._id || reg?.shiftId || '')
        if (shiftId && !map[shiftId]) map[shiftId] = reg
      }
    }
    setWeekRegistrationByShiftId(map)
  }, [fetchMyRegistrations, weekDates])

  useEffect(() => {
    loadWeek()
    loadWeekRegistrations()
  }, [loadWeek, loadWeekRegistrations])

  const handleSelectDate = (dateKey) => {
    setSelectedDate(dateKey)
    setSelectedShift(null)
  }

  const handleSelectShift = (shift, dateKey) => {
    setSelectedDate(dateKey)
    setSelectedShift(shift)
  }

  const handleRegister = async (shiftId) => {
    try {
      const res = await registerShift(shiftId)
      showToast(res?.message || 'Đã gửi đăng ký ca.')
      await loadWeek()
      await loadWeekRegistrations()
      await refresh()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể đăng ký ca.')
    }
  }

  const handleCheckIn = async (shiftId) => {
    try {
      const res = await checkIn(shiftId)
      showToast(res?.message || 'Check-in thành công.')
      await loadWeekRegistrations()
      await refresh()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể check-in.')
    }
  }

  const handleCheckOut = async (shiftId) => {
    try {
      const res = await checkOut(shiftId)
      showToast(res?.message || 'Check-out thành công.')
      await loadWeekRegistrations()
      await refresh()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể check-out.')
    }
  }

  const handleUndoCheckOut = async (shiftId) => {
    try {
      const res = await undoCheckOut(shiftId)
      showToast(res?.message || 'Hoàn tác check-out thành công.')
      await loadWeekRegistrations()
      await refresh()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể hoàn tác check-out.')
    }
  }

  const selectedRegistration = selectedShiftId ? weekRegistrationByShiftId[selectedShiftId] : null
  const regStatus = String(selectedRegistration?.status || '').toUpperCase()
  const isRegistered = Boolean(selectedRegistration)
  const isFull = selectedShift ? isShiftFullOrClosed(selectedShift) : false
  const shiftEndAt = selectedShift ? buildShiftDateTime(selectedShift?.date, selectedShift?.endTime) : null
  const isShiftEnded = Boolean(shiftEndAt && Date.now() > shiftEndAt.getTime())

  const conflictReason = useMemo(() => {
    if (!selectedShiftId || !selectedShift) return ''
    const targetStart = parseTimeToMinutes(selectedShift?.startTime)
    const targetEnd = parseTimeToMinutes(selectedShift?.endTime)
    if (targetStart == null || targetEnd == null) return ''

    const targetDateKey = toDateKey(selectedShift?.date)
    const regs = Object.values(weekRegistrationByShiftId || {})
    for (const reg of regs) {
      const status = String(reg?.status || '').toUpperCase()
      if (status !== 'PENDING' && status !== 'APPROVED') continue
      const otherShift = reg?.shiftId
      const otherShiftId = String(otherShift?._id || reg?.shiftId || '')
      if (!otherShiftId || otherShiftId === selectedShiftId) continue
      if (toDateKey(otherShift?.date) !== targetDateKey) continue
      const otherStart = parseTimeToMinutes(otherShift?.startTime)
      const otherEnd = parseTimeToMinutes(otherShift?.endTime)
      if (otherStart == null || otherEnd == null) continue
      if (isOverlap(targetStart, targetEnd, otherStart, otherEnd)) {
        return 'Bạn đang có ca khác trùng giờ trong ngày, không thể đăng ký.'
      }
    }
    return ''
  }, [selectedShift, selectedShiftId, weekRegistrationByShiftId])

  const canRegister = Boolean(selectedShiftId && !isRegistered && !isFull && !isShiftEnded && !conflictReason)
  const assignedCount = selectedShift ? getAssignedCount(selectedShift) : 0
  const requiredStaff = Number(selectedShift?.requiredStaff || 0)
  const remaining = Math.max(requiredStaff - assignedCount, 0)
  const shiftStatus = String(selectedShift?.status || '').toUpperCase()

  const shiftStartAt = selectedShift ? buildShiftDateTime(selectedShift?.date, selectedShift?.startTime) : null
  const isTooEarlyToCheckIn = Boolean(
    shiftStartAt && Date.now() < (shiftStartAt.getTime() - CHECKIN_EARLY_MINUTES * 60 * 1000),
  )
  const isTooEarlyToCheckOut = false

  const canCheckInAction = Boolean(
    selectedShiftId
      && regStatus === 'APPROVED'
      && !selectedRegistration?.checkInAt
      && shiftStatus !== 'CLOSED'
      && !isTooEarlyToCheckIn,
  )
  const canCheckOutAction = Boolean(
    selectedShiftId
      && regStatus === 'APPROVED'
      && Boolean(selectedRegistration?.checkInAt)
      && !selectedRegistration?.checkOutAt
      && shiftStatus !== 'CLOSED',
  )
  const canUndoCheckOutAction = Boolean(
    selectedShiftId
      && regStatus === 'APPROVED'
      && Boolean(selectedRegistration?.checkInAt)
      && Boolean(selectedRegistration?.checkOutAt)
      && shiftStatus !== 'CLOSED',
  )

  const goPrevWeek = () => handleSelectDate(toDateKey(addDays(weekStart, -7)))
  const goNextWeek = () => handleSelectDate(toDateKey(addDays(weekStart, 7)))

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lịch làm</h1>
          <p className="mt-1 text-sm text-slate-600">Xem ca theo tuần và đăng ký ca phù hợp.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goPrevWeek}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tuần trước
          </button>
          <button
            type="button"
            onClick={goNextWeek}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tuần sau
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleSelectDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="button"
            onClick={() => {
              loadWeek()
              loadWeekRegistrations()
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Làm mới
          </button>
        </div>
      </div>

      {currentShift?.shift ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Bạn đang trong ca: {currentShift.shift.startTime} - {currentShift.shift.endTime}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          Bạn chưa check-in hoặc đã check-out
        </div>
      )}

      {toast ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-sm font-semibold text-slate-800">Tuần: {formatWeekRange(weekStart)}</div>
            {weekLoading ? <div className="text-sm text-slate-500">Đang tải...</div> : null}
          </div>

          <CalendarGrid
            weekDates={weekDates}
            shiftsByDate={weekShiftsByDate}
            selectedDate={selectedDate}
            selectedShiftId={selectedShiftId}
            onSelectDate={handleSelectDate}
            onSelectShift={handleSelectShift}
            emptyHint="Chưa có ca trong tuần này."
          />
        </div>

        <div className="lg:col-span-1">
          <ShiftDetailDrawer
            title={selectedShift ? 'Chi tiết ca' : 'Chọn ca để đăng ký'}
            subtitle={selectedShift ? `${selectedDate} • ${selectedShift?.startTime || ''} - ${selectedShift?.endTime || ''}` : `Ngày: ${new Date(selectedDate).toLocaleDateString('vi-VN')}`}
            footer={selectedShift ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-slate-600">
                    Còn lại: <span className="font-semibold text-slate-900">{remaining}</span>/{requiredStaff || 0}
                  </div>
                  <div className="text-sm text-slate-600">
                    Trạng thái: <span className="font-semibold text-slate-900">{regStatus === 'APPROVED' ? 'Đã duyệt' : (regStatus === 'PENDING' ? 'Chờ duyệt' : (isRegistered ? 'Đã từ chối' : 'Chưa đăng ký'))}</span>
                  </div>
                </div>

                {isShiftEnded ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                    Ca này đã kết thúc, bạn không thể đăng ký.
                  </div>
                ) : null}
                {conflictReason ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                    {conflictReason}
                  </div>
                ) : null}
                {regStatus === 'APPROVED' && isTooEarlyToCheckIn ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                    Bạn chỉ có thể check-in trước tối đa {CHECKIN_EARLY_MINUTES} phút.
                  </div>
                ) : null}
                {null}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleRegister(selectedShiftId)}
                    disabled={!canRegister || Boolean(actionLoadingMap[`register:${selectedShiftId}`])}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isRegistered ? 'Đã đăng ký' : (isFull ? 'Đã đầy' : (actionLoadingMap[`register:${selectedShiftId}`] ? 'Đang đăng ký...' : 'Đăng ký ca'))}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCheckIn(selectedShiftId)}
                    disabled={!canCheckInAction || Boolean(actionLoadingMap[`checkIn:${selectedShiftId}`])}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {actionLoadingMap[`checkIn:${selectedShiftId}`] ? 'Đang check-in...' : 'Check-in'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCheckOut(selectedShiftId)}
                    disabled={!canCheckOutAction || Boolean(actionLoadingMap[`checkOut:${selectedShiftId}`])}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {actionLoadingMap[`checkOut:${selectedShiftId}`] ? 'Đang check-out...' : 'Check-out'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUndoCheckOut(selectedShiftId)}
                    disabled={!canUndoCheckOutAction || Boolean(actionLoadingMap[`undoCheckOut:${selectedShiftId}`])}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {actionLoadingMap[`undoCheckOut:${selectedShiftId}`] ? 'Đang hoàn tác...' : 'Hoàn tác check-out'}
                  </button>
                </div>
              </div>
            ) : null}
            emptyState="Chọn một ca ở lịch tuần bên trái để xem chi tiết và đăng ký."
          >
            {selectedShift ? (
              <div className="space-y-3">
                <ShiftCard
                  shift={selectedShift}
                  selected
                  onClick={() => null}
                  rightSlot={isRegistered ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      Đã đăng ký
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                      {isFull ? 'Đã đầy' : 'Chưa đăng ký'}
                    </span>
                  )}
                />

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Đã đăng ký</div>
                      <div className="mt-1 font-semibold text-slate-900">{assignedCount}/{requiredStaff || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Còn lại</div>
                      <div className="mt-1 font-semibold text-slate-900">{remaining}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Trạng thái đăng ký: {isRegistered ? (String(selectedRegistration?.status || '').toUpperCase() === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt') : 'Chưa đăng ký'}
                  </div>
                </div>
              </div>
            ) : null}
          </ShiftDetailDrawer>
        </div>
      </div>
    </div>
  )
}
