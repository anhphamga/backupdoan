import React, { useMemo } from 'react'

const formatMoney = (v) => `${Number(v || 0).toLocaleString('vi-VN')}đ`
const formatNumber = (v) => Number(v || 0).toLocaleString('vi-VN')
const formatHours = (v) => `${Number(v || 0).toFixed(1)} giờ`

const StatusBadge = ({ tone = 'muted', children, title = '' }) => {
  const cls = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-slate-50 text-slate-600'
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {children}
    </span>
  )
}

export default function ShiftStaffPerformanceTable({ items = [] }) {
  const rows = Array.isArray(items) ? items : []

  const meta = useMemo(() => {
    const hasAnyShift = rows.some((r) => Number(r?.totalShiftsWorked || 0) > 0)
    const hasAnyHours = rows.some((r) => Number(r?.totalHoursWorked || 0) > 0)
    const hasInProgress = rows.some((r) => Number(r?.totalShiftsWorked || 0) > 0 && Number(r?.totalHoursWorked || 0) <= 0)
    return { hasAnyShift, hasAnyHours, hasInProgress }
  }, [rows])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">Hiệu suất nhân sự</h3>
          <p className="mt-1 text-sm text-slate-600">
            Tính theo check-in.
            <span className="ml-2 text-slate-500" title="Chỉ tính giờ khi đã check-out">
              (Chỉ tính giờ khi đã check-out)
            </span>
          </p>
        </div>
        {meta.hasInProgress ? (
          <StatusBadge tone="warning" title="Có nhân sự đang làm nhưng chưa check-out nên chưa tính giờ.">
            Có ca đang làm
          </StatusBadge>
        ) : meta.hasAnyHours ? (
          <StatusBadge tone="success">Đã hoàn tất</StatusBadge>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
          Chưa có dữ liệu nhân sự trong khoảng lọc.
        </div>
      ) : !meta.hasAnyShift ? (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          Không có ca nào có check-in trong khoảng lọc.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4">Nhân sự</th>
                <th className="py-2 pr-4">Số ca</th>
                <th className="py-2 pr-4" title="Chỉ tính giờ khi đã check-out">
                  Giờ làm
                </th>
                <th className="py-2 pr-4">Trạng thái</th>
                <th className="py-2 pr-4">Số đơn</th>
                <th className="py-2 pr-4">Doanh thu</th>
                <th className="py-2 pr-0">TB / ca</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {rows.map((row) => {
                const shifts = Number(row?.totalShiftsWorked || 0)
                const hours = Number(row?.totalHoursWorked || 0)
                const inProgress = shifts > 0 && hours <= 0
                return (
                  <tr key={row.staffId} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-semibold text-slate-900">{row.staffName || 'N/A'}</td>
                    <td className="py-2 pr-4">{formatNumber(shifts)}</td>
                    <td className="py-2 pr-4">
                      {inProgress ? '—' : formatHours(hours)}
                    </td>
                    <td className="py-2 pr-4">
                      {inProgress ? (
                        <StatusBadge tone="warning" title="Đã check-in nhưng chưa check-out.">
                          Đang làm
                        </StatusBadge>
                      ) : hours > 0 ? (
                        <StatusBadge tone="success">Hoàn tất</StatusBadge>
                      ) : (
                        <StatusBadge tone="muted">Chưa có giờ</StatusBadge>
                      )}
                    </td>
                    <td className="py-2 pr-4">{formatNumber(row.totalOrdersHandled)}</td>
                    <td className="py-2 pr-4">{formatMoney(row.totalRevenueHandled)}</td>
                    <td className="py-2 pr-0">{formatMoney(row.averageRevenuePerShift)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

