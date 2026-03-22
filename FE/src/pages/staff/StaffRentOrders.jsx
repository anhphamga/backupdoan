import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAllRentOrdersApi, confirmRentOrderApi, confirmPickupApi, confirmReturnApi, completeWashingApi, finalizeRentOrderApi, markNoShowApi } from '../../services/rent-order.service'

const statusLabels = {
  Draft: 'Nháp',
  PendingDeposit: 'Chờ đặt cọc',
  Deposited: 'Đã đặt cọc',
  Confirmed: 'Đã xác nhận',
  WaitingPickup: 'Chờ lấy đồ',
  Renting: 'Đang thuê',
  WaitingReturn: 'Chờ trả',
  Returned: 'Đã trả',
  Late: 'Trễ hạn',
  Compensation: 'Bồi thường',
  NoShow: 'Không nhận đồ',
  Completed: 'Hoàn tất',
  Cancelled: 'Đã hủy'
}

const statusColors = {
  Draft: 'bg-gray-100 text-gray-800',
  PendingDeposit: 'bg-yellow-100 text-yellow-800',
  Deposited: 'bg-blue-100 text-blue-800',
  Confirmed: 'bg-indigo-100 text-indigo-800',
  WaitingPickup: 'bg-purple-100 text-purple-800',
  Renting: 'bg-green-100 text-green-800',
  WaitingReturn: 'bg-orange-100 text-orange-800',
  Returned: 'bg-cyan-100 text-cyan-800',
  Late: 'bg-amber-100 text-amber-800',
  Compensation: 'bg-rose-100 text-rose-800',
  NoShow: 'bg-red-100 text-red-800',
  Completed: 'bg-green-200 text-green-800',
  Cancelled: 'bg-red-100 text-red-800'
}

const getCustomerText = (customer) => {
  if (!customer) return 'N/A'
  if (typeof customer === 'string') return customer
  if (typeof customer === 'object') {
    const name = customer.name || ''
    const phone = customer.phone || ''
    const email = customer.email || ''
    if (name && phone) return `${name} - ${phone}`
    if (name && email) return `${name} - ${email}`
    if (name) return name
    if (phone) return phone
    if (email) return email
    if (customer._id) return customer._id
  }
  return 'N/A'
}

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : 'N/A')
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('vi-VN') : 'N/A')

export default function StaffRentOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [finalizeMethod, setFinalizeMethod] = useState('Cash')

  const showError = (msg) => {
    setError(msg)
    setActionSuccess('')
    setTimeout(() => setError(''), 6000)
  }

  const showSuccess = (msg) => {
    setActionSuccess(msg)
    setError('')
    setTimeout(() => setActionSuccess(''), 4000)
  }

  // Collateral modal state
  const [showCollateralModal, setShowCollateralModal] = useState(false)
  const [pickupOrderId, setPickupOrderId] = useState(null)
  const [collateralType, setCollateralType] = useState('CASH')
  const [collateralValue, setCollateralValue] = useState('')
  const [collateralError, setCollateralError] = useState('')

  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnOrderId, setReturnOrderId] = useState(null)
  const [returnItems, setReturnItems] = useState([])
  const [returnNote, setReturnNote] = useState('')
  const [returnError, setReturnError] = useState('')

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await getAllRentOrdersApi({})
      const allOrders = response.data || []

      // Filter locally if status selected
      if (filterStatus) {
        setOrders(allOrders.filter(o => o.status === filterStatus))
      } else {
        setOrders(allOrders)
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Không thể tải danh sách đơn thuê')
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleConfirm = async (orderId) => {
    setActionLoading(true)
    try {
      await confirmRentOrderApi(orderId)
      showSuccess('Xác nhận đơn thành công!')
      fetchOrders()
      setSelectedOrder(null)
    } catch (err) {
      showError(err.response?.data?.message || 'Có lỗi xảy ra khi xác nhận đơn')
    } finally {
      setActionLoading(false)
    }
  }

  const openCollateralModal = (orderId) => {
    setCollateralError('')
    setCollateralType('CASH')
    setCollateralValue('')
    setPickupOrderId(orderId)
    setShowCollateralModal(true)
  }

  const closeCollateralModal = () => {
    setShowCollateralModal(false)
    setPickupOrderId(null)
  }

  const handlePickup = async () => {
    if (!pickupOrderId) return

    // Validate collateral input
    if (!collateralType) {
      setCollateralError('Vui lòng chọn loại thế chấp.')
      return
    }

    const collateral = { type: collateralType }

    if (collateralType === 'CASH') {
      const cashAmount = Number(collateralValue)
      if (!collateralValue || Number.isNaN(cashAmount) || cashAmount <= 0) {
        setCollateralError('Số tiền thế chấp không hợp lệ.')
        return
      }
      collateral.cashAmount = cashAmount
    } else {
      const documentNumber = String(collateralValue || '').trim()
      if (!documentNumber) {
        setCollateralError(`Vui lòng nhập số ${collateralType}.`)
        return
      }
      collateral.documentNumber = documentNumber
    }

    setActionLoading(true)
    setCollateralError('')
    try {
      await confirmPickupApi(pickupOrderId, { collateral })
      showSuccess('Xác nhận lấy đồ thành công!')
      fetchOrders()
      setSelectedOrder(null)
      closeCollateralModal()
    } catch (err) {
      setCollateralError(err.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setActionLoading(false)
    }
  }

  const openReturnModal = (order) => {
    setReturnError('')
    setReturnNote('')

    const items = (order?.items || []).map((item) => ({
      productInstanceId: item.productInstanceId?._id || item.productInstanceId,
      label: item.productInstanceId?.productId?.name || item.productInstanceId?._id || 'Sản phẩm',
      condition: 'Dirty',
      damageFee: ''
    }))

    setReturnItems(items)
    setReturnOrderId(order?._id)
    setShowReturnModal(true)
  }

  const closeReturnModal = () => {
    setShowReturnModal(false)
    setReturnOrderId(null)
  }

  const handleReturnConfirm = async () => {
    if (!returnOrderId) return

    const returnedItems = returnItems.map((item) => {
      const rawFee = String(item.damageFee || '')
      const parsedFee = parseInt(rawFee.replace(/[^0-9]/g, ''), 10) || 0
      return {
        productInstanceId: item.productInstanceId,
        condition: item.condition,
        damageFee: item.condition === 'Damaged' ? parsedFee : 0
      }
    })

    setActionLoading(true)
    setReturnError('')
    try {
      await confirmReturnApi(returnOrderId, {
        returnedItems,
        note: returnNote
      })
      showSuccess('Xác nhận trả đồ thành công!')
      fetchOrders()
      setSelectedOrder(null)
      closeReturnModal()
    } catch (err) {
      setReturnError(err.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setActionLoading(false)
    }
  }

  const handleNoShow = async (orderId) => {
    setActionLoading(true)
    try {
      await markNoShowApi(orderId)
      showSuccess('Đã đánh dấu khách no-show. Cọc bị tịch thu.')
      fetchOrders()
      setSelectedOrder(null)
    } catch (err) {
      showError(err.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompleteWashing = async (orderId, method = 'Cash') => {
    setActionLoading(true)
    try {
      await completeWashingApi(orderId, { method })
      showSuccess('Hoàn tất đơn thành công! Sản phẩm đã có sẵn.')
      fetchOrders()
      setSelectedOrder(null)
    } catch (err) {
      showError(err.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setActionLoading(false)
    }
  }

  const handleFinalize = async (orderId) => {
    setActionLoading(true)
    try {
      await finalizeRentOrderApi(orderId, { method: finalizeMethod })
      showSuccess('Chốt đơn thành công!')
      fetchOrders()
      setSelectedOrder(null)
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Có lỗi xảy ra khi chốt đơn'
      showError(msg)
    } finally {
      setActionLoading(false)
    }
  }

  const statusSummary = useMemo(() => {
    return orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1
      return acc
    }, {})
  }, [orders])

  return (
    <div className="min-h-screen bg-slate-100/80">
      <div className="space-y-6">
      {/* Bộ lọc */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">INHERE Staff</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">Quản lý đơn thuê</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Theo dõi trạng thái đơn thuê, xử lý nhanh theo từng bước và giữ mọi thông tin vận hành ở một màn hình rõ ràng hơn.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tổng đơn</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{orders.length}</p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">Đang thuê</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{statusSummary.Renting || 0}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Hoàn tất</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{statusSummary.Completed || 0}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-2 block text-sm font-medium text-slate-700">Lọc theo trạng thái</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="">Tất cả</option>
                  <option value="PendingDeposit">Chờ đặt cọc</option>
                  <option value="Deposited">Đã đặt cọc</option>
                  <option value="Confirmed">Đã xác nhận</option>
                  <option value="WaitingPickup">Chờ lấy đồ</option>
                  <option value="Renting">Đang thuê</option>
                  <option value="Completed">Hoàn tất</option>
                  <option value="Cancelled">Đã hủy</option>
                </select>
              </div>
              <button
                onClick={fetchOrders}
                className="h-12 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Làm mới
              </button>
            </div>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
          {actionSuccess}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 shadow-sm">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        {/* Danh sách đơn */}
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Danh sách đơn</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">Đơn thuê hiện tại</h3>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">{orders.length} đơn</div>
          </div>

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center px-6 py-10">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex min-h-[420px] items-center justify-center px-6 py-10 text-center text-sm text-slate-500">Không có đơn thuê nào</div>
          ) : (
            <div className="max-h-[calc(100vh-240px)] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              {orders.map((order) => (
                <button
                  key={order._id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full rounded-[24px] border p-5 text-left transition ${selectedOrder?._id === order._id ? 'border-indigo-200 bg-indigo-50/80 shadow-[0_16px_36px_rgba(79,70,229,0.14)]' : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-md'}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-950">
                        #{order._id}
                      </p>
                      <p className="mt-3 text-sm font-medium text-slate-700">
                        Khách hàng: {getCustomerText(order.customerId)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Tạo lúc: {formatDateTime(order.createdAt)}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusColors[order.status] || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Khoảng thuê</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">{formatDate(order.rentStartDate)} - {formatDate(order.rentEndDate)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 sm:text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tổng tiền</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{formatMoney(order.totalAmount || 0)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chi tiết đơn */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          {selectedOrder ? (
            <div>
              <div className="rounded-[24px] bg-[linear-gradient(135deg,#eef2ff,#ffffff)] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Chi tiết đơn</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-950">#{selectedOrder._id}</h3>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusColors[selectedOrder.status] || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                    {statusLabels[selectedOrder.status] || selectedOrder.status}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Khách hàng</p>
                  <p className="mt-3 text-base font-semibold text-slate-950">{getCustomerText(selectedOrder.customerId)}</p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ngày thuê</p>
                  <p className="mt-3 text-base font-semibold text-slate-950">
                    {formatDate(selectedOrder.rentStartDate)} - {formatDate(selectedOrder.rentEndDate)}
                  </p>
                </div>

                {/* Thông tin thanh toán */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Thông tin thanh toán</p>

                  <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Tiền thuê:</span>
                      <span className="font-semibold text-slate-900">{formatMoney(selectedOrder.totalAmount || 0)}</span>
                    </div>
                    <div className="mt-3 flex justify-between text-sm">
                      <span className="text-slate-500">Đặt cọc (50%):</span>
                      <span className="font-semibold text-indigo-600">{formatMoney(selectedOrder.depositAmount || 0)}</span>
                    </div>
                    <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm">
                      <span className="text-slate-500">Còn lại:</span>
                      <span className="font-semibold text-slate-900">{formatMoney((selectedOrder.totalAmount || 0) - (selectedOrder.depositAmount || 0))}</span>
                    </div>
                  </div>

                  {/* Phí phát sinh (nếu có) */}
                  {(selectedOrder.washingFee > 0 || selectedOrder.damageFee > 0) && (
                    <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                      <p className="text-sm font-semibold text-orange-800">Phí phát sinh</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Giặt:</span>
                        <span className="font-semibold text-slate-900">{formatMoney(selectedOrder.washingFee || 0)}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-slate-500">Hư hỏng:</span>
                        <span className="font-semibold text-slate-900">{formatMoney(selectedOrder.damageFee || 0)}</span>
                      </div>
                      <div className="mt-3 flex justify-between border-t border-orange-200 pt-3 text-sm font-semibold">
                        <span className="text-orange-800">Tổng cần thanh toán:</span>
                        <span className="text-orange-800">{formatMoney((selectedOrder.totalAmount || 0) - (selectedOrder.depositAmount || 0) + (selectedOrder.washingFee || 0) + (selectedOrder.damageFee || 0))}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
                  {selectedOrder.status === 'Deposited' && (
                    <button
                      onClick={() => handleConfirm(selectedOrder._id)}
                      disabled={actionLoading}
                      className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                    >
                      {actionLoading ? 'Đang xử lý...' : 'Xác nhận đơn (Chờ khách lấy đồ)'}
                    </button>
                  )}

                  {['Deposited', 'Confirmed', 'WaitingPickup'].includes(selectedOrder.status) && (
                    <button
                      onClick={() => handleNoShow(selectedOrder._id)}
                      disabled={actionLoading}
                      className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                    >
                      {actionLoading ? 'Đang xử lý...' : 'Đánh dấu No-Show'}
                    </button>
                  )}

                  {selectedOrder.status === 'Confirmed' && (
                    <button
                      onClick={() => openCollateralModal(selectedOrder._id)}
                      disabled={actionLoading}
                      className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                    >
                      {actionLoading ? 'Đang xử lý...' : 'Xác nhận chờ lấy đồ'}
                    </button>
                  )}

                  {selectedOrder.status === 'WaitingPickup' && (
                    <button
                      onClick={() => openCollateralModal(selectedOrder._id)}
                      disabled={actionLoading}
                      className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                      {actionLoading ? 'Đang xử lý...' : 'Xác nhận khách đã lấy đồ'}
                    </button>
                  )}

                  {selectedOrder.status === 'Renting' && (
                    <button
                      onClick={() => openReturnModal(selectedOrder)}
                      disabled={actionLoading}
                      className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
                    >
                      {actionLoading ? 'Đang xử lý...' : 'Xác nhận trả đồ'}
                    </button>
                  )}

                  {['WaitingReturn', 'Late', 'Compensation', 'NoShow'].includes(selectedOrder.status) && (
                    <div className="border-t pt-4 space-y-4">
                      <p className="text-sm text-gray-600">Xác nhận khách đã trả đồ và chuyển sang bước thanh toán.</p>
                      <button
                        onClick={() => handleFinalize(selectedOrder._id)}
                        disabled={actionLoading}
                        className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                      >
                        {actionLoading ? 'Đang xử lý...' : 'Chốt đơn'}
                      </button>
                    </div>
                  )}

                  {selectedOrder.status === 'Returned' && (
                    <div className="border-t pt-4 space-y-4">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-sm text-gray-600">Đã đặt cọc</div>
                          <div className="text-sm font-medium">{(selectedOrder.depositAmount || 0).toLocaleString('vi-VN')}đ</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-sm text-gray-600">Còn lại cần thu</div>
                          <div className="text-sm font-medium">{((selectedOrder.remainingAmount || 0) + (selectedOrder.lateFee || 0) + (selectedOrder.damageFee || 0) + (selectedOrder.compensationFee || 0)).toLocaleString('vi-VN')}đ</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-sm text-gray-600">Tổng phí phát sinh</div>
                          <div className="text-sm font-medium">{(((selectedOrder.lateFee || 0) + (selectedOrder.damageFee || 0) + (selectedOrder.compensationFee || 0))).toLocaleString('vi-VN')}đ</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-sm text-gray-600">Số tiền cần thu thêm</div>
                          <div className="text-sm font-medium">
                            {Math.max(0, (selectedOrder.remainingAmount || 0) + (selectedOrder.lateFee || 0) + (selectedOrder.damageFee || 0) + (selectedOrder.compensationFee || 0) - (selectedOrder.depositAmount || 0)).toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-sm text-gray-600">Số tiền trả lại</div>
                          <div className="text-sm font-medium">
                            {Math.max(0, (selectedOrder.depositAmount || 0) - ((selectedOrder.remainingAmount || 0) + (selectedOrder.lateFee || 0) + (selectedOrder.damageFee || 0) + (selectedOrder.compensationFee || 0))).toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <label className="text-sm font-medium text-gray-600">Phương thức thanh toán</label>
                        <select
                          value={finalizeMethod}
                          onChange={(e) => setFinalizeMethod(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2"
                        >
                          <option value="Cash">Tiền mặt</option>
                          <option value="Online">Chuyển khoản</option>
                        </select>
                      </div>
                      <button
                        onClick={() => handleCompleteWashing(selectedOrder._id, finalizeMethod)}
                        disabled={actionLoading}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {actionLoading ? 'Đang xử lý...' : 'Hoàn tất đơn (Sản phẩm sẵn sàng)'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Chọn một đơn để xem chi tiết
            </div>
          )}
        </div>
      </div>

      {/* Collateral Modal */}
      {showCollateralModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:items-center sm:pb-0">
          <div className="w-full max-w-md bg-white rounded-[28px] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-[linear-gradient(135deg,#eef2ff,#fff)] px-6 pt-6 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100">
                  <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">Bàn giao đồ</p>
                  <h2 className="text-lg font-semibold text-slate-950">Thông tin thế chấp</h2>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Type selector as cards */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Loại thế chấp</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'CASH', label: 'Tiền mặt', icon: '💵' },
                    { value: 'CCCD', label: 'CCCD', icon: '🪪' },
                    { value: 'GPLX', label: 'GPLX', icon: '🚗' },
                    { value: 'CAVET', label: 'Cavet xe', icon: '📋' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setCollateralType(opt.value); setCollateralValue(''); setCollateralError(''); }}
                      className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                        collateralType === opt.value
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value input */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {collateralType === 'CASH' ? 'Số tiền thế chấp (VND)' : `Số ${collateralType}`}
                </label>
                <input
                  type={collateralType === 'CASH' ? 'number' : 'text'}
                  value={collateralValue}
                  onChange={(e) => { setCollateralValue(e.target.value); setCollateralError(''); }}
                  placeholder={collateralType === 'CASH' ? 'Nhập số tiền...' : `Nhập số ${collateralType}...`}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              {/* Error */}
              {collateralError && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                  {collateralError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={closeCollateralModal}
                disabled={actionLoading}
                className="flex-1 h-11 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handlePickup}
                disabled={actionLoading}
                className="flex-1 h-11 rounded-2xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    Đang xử lý...
                  </span>
                ) : 'Xác nhận bàn giao'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:items-center sm:pb-0">
          <div className="w-full max-w-xl bg-white rounded-[28px] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-[linear-gradient(135deg,#fff7ed,#fff)] px-6 pt-6 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100">
                  <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">Nhận lại đồ</p>
                  <h2 className="text-lg font-semibold text-slate-950">Xác nhận khách trả đồ</h2>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Product list */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tình trạng sản phẩm</p>
                <div className="space-y-3">
                  {returnItems.map((item, index) => (
                    <div key={item.productInstanceId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{item.label}</p>
                        <div className="flex shrink-0 gap-1.5">
                          {[
                            { value: 'Dirty', label: 'Bẩn', active: 'bg-yellow-100 border-yellow-300 text-yellow-700' },
                            { value: 'Damaged', label: 'Hư hỏng', active: 'bg-red-100 border-red-300 text-red-700' },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                const next = [...returnItems]
                                next[index].condition = opt.value
                                if (opt.value !== 'Damaged') next[index].damageFee = ''
                                setReturnItems(next)
                              }}
                              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                                item.condition === opt.value
                                  ? opt.active + ' shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {item.condition === 'Damaged' && (
                        <div className="mt-3 flex items-center gap-3">
                          <label className="shrink-0 text-xs font-semibold text-slate-500">Phí bồi thường (VND)</label>
                          <input
                            type="text"
                            value={item.damageFee}
                            onChange={(e) => {
                              const next = [...returnItems]
                              next[index].damageFee = e.target.value
                              setReturnItems(next)
                            }}
                            placeholder="VD: 100000"
                            className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Ghi chú (tuỳ chọn)
                </label>
                <textarea
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  rows={2}
                  placeholder="Ví dụ: 2 món bẩn, 1 món rách cổ..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-50 resize-none"
                />
              </div>

              {/* Error */}
              {returnError && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                  {returnError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={closeReturnModal}
                disabled={actionLoading}
                className="flex-1 h-11 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReturnConfirm}
                disabled={actionLoading}
                className="flex-1 h-11 rounded-2xl bg-orange-500 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
              >
                {actionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    Đang xử lý...
                  </span>
                ) : 'Xác nhận trả đồ'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}


