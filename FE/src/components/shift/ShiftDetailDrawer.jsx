import React from 'react'

export default function ShiftDetailDrawer({
  title = 'Chi tiết ca làm',
  subtitle = '',
  children,
  footer,
  emptyState,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
          {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
        </div>
      </div>

      <div className="mt-4">
        {children ? children : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            {emptyState || 'Chọn một ngày hoặc một ca để xem chi tiết.'}
          </div>
        )}
      </div>

      {footer ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

