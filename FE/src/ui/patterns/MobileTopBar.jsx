import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, ShoppingCart } from 'lucide-react'
import { useBuyCart } from '../../contexts/BuyCartContext'
import { useRentalCart } from '../../contexts/RentalCartContext'

export default function MobileTopBar({ placeholder = 'Tìm trang phục...' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { itemCount: rentCount } = useRentalCart() || { itemCount: 0 }
  const { itemCount: buyCount } = useBuyCart() || { itemCount: 0 }
  const totalCartCount = Number(rentCount || 0) + Number(buyCount || 0)

  const initialQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('q') || ''
  }, [location.search])

  const [query, setQuery] = useState(initialQuery)

  const handleSubmit = (event) => {
    event.preventDefault()
    const keyword = String(query || '').trim()
    const params = new URLSearchParams()
    if (keyword) params.set('q', keyword)
    navigate({ pathname: '/buy', search: params.toString() ? `?${params}` : '' })
  }

  return (
    <div className="sticky top-0 z-40 border-b border-white/60 bg-[linear-gradient(135deg,rgba(255,251,244,0.92),rgba(255,255,255,0.96))] backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="min-h-9 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            inputMode="search"
          />
        </form>
        <button
          type="button"
          onClick={() => navigate('/cart')}
          className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white"
          aria-label="Giỏ hàng"
        >
          <ShoppingCart className="h-5 w-5 text-slate-700" />
          {totalCartCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white">
              {totalCartCount}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  )
}

