import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import {
  approveShiftRegistration,
  checkInShiftRegistration,
  checkOutShiftRegistration,
  closeShiftSchedule,
  createShiftSchedule,
  getCurrentShift,
  getMyShiftRegistrations,
  getShiftRegistrationsByShiftId,
  getShiftSchedules,
  registerShiftSchedule,
  rejectShiftRegistration,
  undoCheckoutShiftRegistration,
  updateShiftSchedule,
} from '../api/shiftScheduleApi'
import { clearStoredActiveShift, setStoredActiveShiftId } from '../utils/shift.utils'

const toDateInputValue = (value) => {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const extractApiMessage = (error, fallback) => {
  return error?.response?.data?.message || error?.message || fallback
}

export const useShiftSchedules = (options = {}) => {
  const { user } = useAuth()
  const role = String(user?.role || '').trim().toLowerCase()
  const initialDate = options.initialDate || toDateInputValue(new Date())

  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionLoadingMap, setActionLoadingMap] = useState({})

  const [myRegistrations, setMyRegistrations] = useState([])
  const [registrationsByShiftId, setRegistrationsByShiftId] = useState({})
  const [currentShift, setCurrentShift] = useState(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const setActionLoading = useCallback((key, value) => {
    setActionLoadingMap((prev) => {
      const next = { ...prev }
      if (value) next[key] = true
      else delete next[key]
      return next
    })
  }, [])

  const fetchShifts = useCallback(async (dateValue = selectedDate, fetchOptions = {}) => {
    const silent = Boolean(fetchOptions?.silent)
    try {
      if (!silent) {
        setLoading(true)
        setError('')
      }
      const response = await getShiftSchedules({ date: dateValue, limit: 200, page: 1 })
      const payload = response?.data
      const items = payload?.data?.items || payload?.data?.data?.items || payload?.data?.items || payload?.items
      const resolvedItems = Array.isArray(payload?.data?.items)
        ? payload.data.items
        : Array.isArray(payload?.data?.data?.items)
          ? payload.data.data.items
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(items)
              ? items
              : []
      if (!mountedRef.current) return resolvedItems
      if (!silent) setShifts(resolvedItems)
      return resolvedItems
    } catch (apiError) {
      if (!mountedRef.current) return []
      if (!silent) {
        setError(extractApiMessage(apiError, 'Không thể tải danh sách ca làm.'))
        setShifts([])
      }
      return []
    } finally {
      if (mountedRef.current && !silent) setLoading(false)
    }
  }, [selectedDate])

  const fetchMyRegistrations = useCallback(async (dateValue = selectedDate, fetchOptions = {}) => {
    const silent = Boolean(fetchOptions?.silent)
    if (role !== 'staff') {
      setMyRegistrations([])
      return []
    }

    try {
      const response = await getMyShiftRegistrations({ date: dateValue, limit: 200, page: 1 })
      const payload = response?.data
      const items = payload?.data?.items || payload?.data?.data?.items || payload?.data || []
      const resolvedItems = Array.isArray(items) ? items : (Array.isArray(payload?.data?.items) ? payload.data.items : [])
      if (!mountedRef.current) return resolvedItems
      if (!silent) setMyRegistrations(resolvedItems)
      return resolvedItems
    } catch {
      if (!mountedRef.current) return []
      if (!silent) setMyRegistrations([])
      return []
    }
  }, [role, selectedDate])

  const fetchRegistrationsForShift = useCallback(async (shiftId) => {
    if (role !== 'owner') {
      return []
    }
    const key = `registrations:${shiftId}`
    try {
      setActionLoading(key, true)
      const response = await getShiftRegistrationsByShiftId(shiftId)
      const payload = response?.data
      const items = payload?.data?.items || payload?.data || []
      const resolvedItems = Array.isArray(items) ? items : []
      if (!mountedRef.current) return resolvedItems
      setRegistrationsByShiftId((prev) => ({ ...prev, [shiftId]: resolvedItems }))
      return resolvedItems
    } catch (apiError) {
      if (!mountedRef.current) return []
      setError(extractApiMessage(apiError, 'KhÃ´ng thá»ƒ táº£i danh sÃ¡ch Ä‘Äƒng kÃ½.'))
      return []
    } finally {
      if (mountedRef.current) setActionLoading(key, false)
    }
  }, [role, setActionLoading])

  const fetchCurrentShift = useCallback(async () => {
    if (role !== 'staff') {
      setCurrentShift(null)
      return null
    }

    const key = 'currentShift'
    try {
      setActionLoading(key, true)
      const response = await getCurrentShift()
      const payload = response?.data
      const data = payload?.data ?? null
      if (!mountedRef.current) return data
      setCurrentShift(data)
      return data
    } catch {
      if (!mountedRef.current) return null
      setCurrentShift(null)
      return null
    } finally {
      if (mountedRef.current) setActionLoading(key, false)
    }
  }, [role, setActionLoading])

  const refresh = useCallback(async () => {
    const items = await fetchShifts(selectedDate)
    if (role === 'staff') {
      await fetchMyRegistrations(selectedDate)
      await fetchCurrentShift()
    }
    if (role === 'owner') {
      // keep cached registrations; owner can refresh per shift when expanding
    }
    return items
  }, [fetchMyRegistrations, fetchShifts, role, selectedDate])

  useEffect(() => {
    refresh()
  }, [refresh])

  const myRegistrationByShiftId = useMemo(() => {
    const map = {}
    for (const item of myRegistrations) {
      const shiftId = String(item?.shiftId?._id || item?.shiftId || '')
      if (shiftId) map[shiftId] = item
    }
    return map
  }, [myRegistrations])

  const createShift = useCallback(async (payload) => {
    const key = 'createShift'
    try {
      setActionLoading(key, true)
      setError('')
      const response = await createShiftSchedule(payload)
      await refresh()
      return response?.data
    } catch (apiError) {
      setError(extractApiMessage(apiError, 'KhÃ´ng thá»ƒ táº¡o ca lÃ m.'))
      throw apiError
    } finally {
      setActionLoading(key, false)
    }
  }, [refresh, setActionLoading])

  const registerShift = useCallback(async (shiftId) => {
    const key = `register:${shiftId}`
    try {
      setActionLoading(key, true)
      setError('')
      const response = await registerShiftSchedule({ shiftId })
      await fetchMyRegistrations(selectedDate)
      await fetchShifts(selectedDate)
      return response?.data
    } catch (apiError) {
      setError(extractApiMessage(apiError, 'KhÃ´ng thá»ƒ Ä‘Äƒng kÃ½ ca lÃ m.'))
      throw apiError
    } finally {
      setActionLoading(key, false)
    }
  }, [fetchMyRegistrations, fetchShifts, selectedDate, setActionLoading])

  const approveRegistration = useCallback(async (registrationId, shiftId) => {
    const key = `approve:${registrationId}`
    try {
      setActionLoading(key, true)
      setError('')
      const response = await approveShiftRegistration({ registrationId })
      await fetchShifts(selectedDate)
      if (shiftId) await fetchRegistrationsForShift(shiftId)
      return response?.data
    } catch (apiError) {
      setError(extractApiMessage(apiError, 'KhÃ´ng thá»ƒ duyá»‡t Ä‘Äƒng kÃ½.'))
      throw apiError
    } finally {
      setActionLoading(key, false)
    }
  }, [fetchRegistrationsForShift, fetchShifts, selectedDate, setActionLoading])

  const rejectRegistrationAction = useCallback(async (registrationId, shiftId) => {
    const key = `reject:${registrationId}`
    try {
      setActionLoading(key, true)
      setError('')
      const response = await rejectShiftRegistration({ registrationId })
      await fetchShifts(selectedDate)
      if (shiftId) await fetchRegistrationsForShift(shiftId)
      return response?.data
    } catch (apiError) {
      setError(extractApiMessage(apiError, 'KhÃ´ng thá»ƒ tá»« chá»‘i Ä‘Äƒng kÃ½.'))
      throw apiError
    } finally {
      setActionLoading(key, false)
    }
  }, [fetchRegistrationsForShift, fetchShifts, selectedDate, setActionLoading])

  const checkIn = useCallback(async (shiftId) => {
    const key = `checkIn:${shiftId}`
    try {
      setActionLoading(key, true)
      setError('')
      const response = await checkInShiftRegistration({ shiftId })
      await fetchMyRegistrations(selectedDate)
      await fetchCurrentShift()
      setStoredActiveShiftId(shiftId)
      return response?.data
    } catch (apiError) {
      setError(extractApiMessage(apiError, 'KhÃ´ng thá»ƒ check-in.'))
      throw apiError
    } finally {
      setActionLoading(key, false)
    }
  }, [fetchMyRegistrations, selectedDate, setActionLoading])

  const checkOut = useCallback(async (shiftId) => {
    const key = `checkOut:${shiftId}`
    try {
      setActionLoading(key, true)
      setError('')
      const response = await checkOutShiftRegistration({ shiftId })
      await fetchMyRegistrations(selectedDate)
      clearStoredActiveShift()
      await fetchCurrentShift()
      return response?.data
    } catch (apiError) {
      setError(extractApiMessage(apiError, 'KhÃ´ng thá»ƒ check-out.'))
      throw apiError
    } finally {
      setActionLoading(key, false)
    }
  }, [fetchMyRegistrations, selectedDate, setActionLoading])

  const undoCheckOut = useCallback(async (shiftId) => {
    const key = `undoCheckOut:${shiftId}`
    try {
      setActionLoading(key, true)
      setError('')
      const response = await undoCheckoutShiftRegistration({ shiftId })
      await fetchMyRegistrations(selectedDate)
      await fetchCurrentShift()
      setStoredActiveShiftId(shiftId)
      return response?.data
    } catch (apiError) {
      setError(extractApiMessage(apiError, 'KhÃ´ng thá»ƒ hoÃ n tÃ¡c check-out.'))
      throw apiError
    } finally {
      setActionLoading(key, false)
    }
  }, [fetchCurrentShift, fetchMyRegistrations, selectedDate, setActionLoading])

  const closeShift = useCallback(async (shiftId) => {
    const key = `close:${shiftId}`
    try {
      setActionLoading(key, true)
      setError('')
      const response = await closeShiftSchedule(shiftId)
      await fetchShifts(selectedDate)
      return response?.data
    } catch (apiError) {
      setError(extractApiMessage(apiError, 'KhÃ´ng thá»ƒ Ä‘Ã³ng ca.'))
      throw apiError
    } finally {
      setActionLoading(key, false)
    }
  }, [fetchShifts, selectedDate, setActionLoading])

  const updateShift = useCallback(async (shiftId, payload = {}) => {
    const key = `update:${shiftId}`
    try {
      setActionLoading(key, true)
      setError('')
      const response = await updateShiftSchedule(shiftId, payload)
      await fetchShifts(selectedDate)
      return response?.data
    } catch (apiError) {
      setError(extractApiMessage(apiError, 'Không thể cập nhật ca làm.'))
      throw apiError
    } finally {
      setActionLoading(key, false)
    }
  }, [fetchShifts, selectedDate, setActionLoading])

  return {
    role,
    selectedDate,
    setSelectedDate,
    shifts,
    loading,
    error,
    actionLoadingMap,
    refresh,
    fetchShifts,
    fetchMyRegistrations,
    currentShift,
    fetchCurrentShift,
    createShift,
    registerShift,
    approveRegistration,
    rejectRegistration: rejectRegistrationAction,
    checkIn,
    checkOut,
    undoCheckOut,
    closeShift,
    updateShift,
    myRegistrations,
    myRegistrationByShiftId,
    registrationsByShiftId,
    fetchRegistrationsForShift,
  }
}
