import Skeleton from '../primitives/Skeleton'

export default function ProductGrid({ items = [], loading = false, onSelect }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
            <div className="p-3">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="mt-2 h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect?.(p)}
          className="rounded-2xl bg-white text-left shadow-sm ring-1 ring-slate-100 transition active:scale-[0.99]"
        >
          <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100">
            <img
              src={p.imageUrl}
              alt={p.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-3">
            <p className="line-clamp-2 text-sm font-semibold text-slate-900">{p.name}</p>
            {p.meta ? <p className="mt-1 line-clamp-1 text-xs text-slate-500">{p.meta}</p> : null}
          </div>
        </button>
      ))}
    </div>
  )
}

