import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useShiftSchedules } from '../../hooks/useShiftSchedules'
import CalendarGrid from '../../components/shift/CalendarGrid'
import ShiftDetailDrawer from '../../components/shift/ShiftDetailDrawer'
import ShiftCard from '../../components/shift/ShiftCard'
import ShiftCreateForm from '../../components/shift/ShiftCreateForm'
import ShiftRegistrationsPanel from '../../components/shift/ShiftRegistrationsPanel'

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
  const day = d.getDay() // 0..6 (Sun..Sat)
  const diff = day === 0 ? -6 : 1 - day
  return addDays(d, diff)
}

const formatWeekRange = (weekStartDate) => {
  const start = weekStartDate instanceof Date ? weekStartDate : new Date(weekStartDate)
  const end = addDays(start, 6)
  return `${start.toLocaleDateString('vi-VN')} - ${end.toLocaleDateString('vi-VN')}`
}

const sortByTime = (items = []) => [...items].sort((a, b) => String(a?.startTime || '').localeCompare(String(b?.startTime || '')))

export default function OwnerShiftSchedulesPage() {
  const {
    selectedDate,
    setSelectedDate,
    actionLoadingMap,
    error,
    createShift,
    refresh,
    fetchShifts,
    fetchRegistrationsForShift,
    registrationsByShiftId,
    approveRegistration,
    rejectRegistration,
    closeShift,
    updateShift,
  } = useShiftSchedules()

  const [toast, setToast] = useState('')
  const [weekLoading, setWeekLoading] = useState(false)
  const [weekShiftsByDate, setWeekShiftsByDate] = useState({})
  const [selectedShift, setSelectedShift] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editRequiredStaff, setEditRequiredStaff] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    if (!msg) return
    setTimeout(() => setToast(''), 3500)
  }

  const weekStart = useMemo(() => getWeekStartMonday(selectedDate), [selectedDate])
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const selectedDateShifts = useMemo(() => {
    const items = weekShiftsByDate?.[selectedDate]
    return Array.isArray(items) ? sortByTime(items) : []
  }, [selectedDate, weekShiftsByDate])

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

  useEffect(() => {
    loadWeek()
  }, [loadWeek])

  const handleCreate = async (payload) => {
    try {
      const res = await createShift(payload)
      showToast(res?.message || 'Tạo ca thành công.')
      setShowCreate(false)
      await loadWeek()
      await refresh()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể tạo ca.')
    }
  }

  const handleCloseShift = async (shiftId, status) => {
    if (String(status || '').toUpperCase() === 'CLOSED') return
    const ok = window.confirm('Bạn chắc chắn muốn đóng ca này? Sau khi đóng, nhân viên không thể đăng ký/duyệt/check-in/check-out.')
    if (!ok) return
    try {
      const res = await closeShift(shiftId)
      showToast(res?.message || 'Đã đóng ca.')
      await loadWeek()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể đóng ca.')
    }
  }

  const handleSelectDate = (dateKey) => {
    setSelectedDate(dateKey)
    setSelectedShift(null)
    setShowCreate(false)
  }

  const handleSelectShift = async (shift, dateKey) => {
    const shiftId = String(shift?._id || '')
    if (!shiftId) return
    setSelectedDate(dateKey)
    setSelectedShift(shift)
    setEditRequiredStaff(String(shift?.requiredStaff ?? ''))
    setShowCreate(false)
    try {
      await fetchRegistrationsForShift(shiftId)
    } catch {
      // keep UI stable; error is surfaced via existing error states/toast elsewhere
    }
  }

  const selectedShiftId = String(selectedShift?._id || '')
  const regItems = selectedShiftId ? (registrationsByShiftId[selectedShiftId] || []) : []
  const pendingRegs = regItems.filter((r) => String(r?.status || '').toUpperCase() === 'PENDING')
  const assignedCount = Array.isArray(selectedShift?.assignedStaffIds) ? selectedShift.assignedStaffIds.length : Number(selectedShift?.assignedStaffCount || 0)
  const shiftStartAt = useMemo(() => {
    if (!selectedShift?.date || !selectedShift?.startTime) return null
    const d = new Date(selectedShift.date)
    if (Number.isNaN(d.getTime())) return null
    const m = /^(\d{2}):(\d{2})$/.exec(String(selectedShift.startTime))
    if (!m) return null
    d.setHours(Number(m[1]), Number(m[2]), 0, 0)
    return Number.isNaN(d.getTime()) ? null : d
  }, [selectedShift])
  const canEditRequiredStaff = Boolean(
    selectedShiftId
      && String(selectedShift?.status || '').toUpperCase() !== 'CLOSED'
      && (!shiftStartAt || Date.now() < shiftStartAt.getTime()),
  )

  const saveRequiredStaff = async () => {
    if (!selectedShiftId) return
    const next = Number(editRequiredStaff)
    if (!Number.isInteger(next) || next < 1) {
      showToast('Số lượng nhân sự phải là số nguyên và > 0.')
      return
    }
    if (Number.isFinite(assignedCount) && next < assignedCount) {
      showToast(`Không thể giảm số nhân sự xuống dưới ${assignedCount} (đã đăng ký/đã duyệt).`)
      return
    }
    try {
      const res = await updateShift(selectedShiftId, { requiredStaff: next })
      showToast(res?.message || 'Đã cập nhật số nhân sự.')
      // cập nhật shift đang chọn để UI phản ánh ngay
      setSelectedShift((prev) => (prev ? { ...prev, requiredStaff: next } : prev))
      await loadWeek()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể cập nhật ca làm.')
    }
  }

  const approveAllPending = async () => {
    if (!selectedShiftId || pendingRegs.length === 0) return
    try {
      for (const r of pendingRegs) {
        const id = String(r?._id || '')
        if (id) await approveRegistration(id, selectedShiftId)
      }
      showToast('Đã duyệt tất cả đăng ký chờ duyệt.')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể duyệt tất cả.')
    }
  }

  const rejectAllPending = async () => {
    if (!selectedShiftId || pendingRegs.length === 0) return
    const ok = window.confirm('Từ chối tất cả đăng ký đang chờ duyệt?')
    if (!ok) return
    try {
      for (const r of pendingRegs) {
        const id = String(r?._id || '')
        if (id) await rejectRegistration(id, selectedShiftId)
      }
      showToast('Đã từ chối tất cả đăng ký chờ duyệt.')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể từ chối tất cả.')
    }
  }

  const goPrevWeek = () => handleSelectDate(toDateKey(addDays(weekStart, -7)))
  const goNextWeek = () => handleSelectDate(toDateKey(addDays(weekStart, 7)))

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lịch làm</h1>
          <p className="mt-1 text-sm text-slate-600">Xem ca theo tuần, tạo ca mới và duyệt đăng ký nhân sự.</p>
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
            onClick={() => loadWeek()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Làm mới
          </button>
        </div>
      </div>

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
            title={selectedShift ? 'Chi tiết ca làm' : 'Ca trong ngày'}
            subtitle={selectedShift ? `${selectedDate} • ${selectedShift?.startTime || ''} - ${selectedShift?.endTime || ''}` : `Ngày: ${new Date(selectedDate).toLocaleDateString('vi-VN')}`}
            footer={selectedShift ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{pendingRegs.length}</span> đăng ký chờ duyệt
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={approveAllPending}
                    disabled={pendingRegs.length === 0}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Duyệt tất cả
                  </button>
                  <button
                    type="button"
                    onClick={rejectAllPending}
                    disabled={pendingRegs.length === 0}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-slate-600">{selectedDateShifts.length} ca</div>
                <button
                  type="button"
                  onClick={() => setShowCreate((v) => !v)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Tạo ca mới
                </button>
              </div>
            )}
          >
            {selectedShift ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Ca {selectedShift?.startTime} - {selectedShift?.endTime}</div>
                    <div className="mt-1 text-xs text-slate-600">Nhấp vào nhân sự trong danh sách để xem trạng thái.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCloseShift(selectedShiftId, selectedShift?.status)}
                    disabled={String(selectedShift?.status || '').toUpperCase() === 'CLOSED' || Boolean(actionLoadingMap[`close:${selectedShiftId}`])}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {actionLoadingMap[`close:${selectedShiftId}`] ? 'Đang đóng...' : 'Đóng ca'}
                  </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">Số lượng nhân sự</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {canEditRequiredStaff ? 'Chỉ có thể chỉnh trước khi ca bắt đầu và khi ca chưa đóng.' : 'Không thể chỉnh khi ca đã bắt đầu hoặc đã đóng.'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={editRequiredStaff}
                          disabled={!canEditRequiredStaff}
                          onChange={(e) => setEditRequiredStaff(e.target.value)}
                          className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                        <button
                          type="button"
                          onClick={saveRequiredStaff}
                          disabled={!canEditRequiredStaff || Boolean(actionLoadingMap[`update:${selectedShiftId}`])}
                          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {actionLoadingMap[`update:${selectedShiftId}`] ? 'Đang lưu...' : 'Lưu'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <ShiftRegistrationsPanel
                  shiftId={selectedShiftId}
                  items={regItems}
                  loading={Boolean(actionLoadingMap[`registrations:${selectedShiftId}`])}
                  errorMessage=""
                  onApprove={(id) => approveRegistration(id, selectedShiftId)}
                  onReject={(id) => rejectRegistration(id, selectedShiftId)}
                  actionLoadingMap={actionLoadingMap}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {showCreate ? (
                  <ShiftCreateForm
                    onSubmit={handleCreate}
                    loading={Boolean(actionLoadingMap.createShift)}
                    errorMessage=""
                    initialDate={selectedDate}
                  />
                ) : null}

                {selectedDateShifts.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                    Chưa có ca trong ngày này.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDateShifts.map((shift) => {
                      const shiftId = String(shift?._id || '')
                      return (
                        <ShiftCard
                          key={shiftId}
                          shift={shift}
                          selected={false}
                          onClick={() => handleSelectShift(shift, selectedDate)}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </ShiftDetailDrawer>
        </div>
      </div>
    </div>
  )
}
