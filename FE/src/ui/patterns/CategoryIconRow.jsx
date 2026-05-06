import Skeleton from '../primitives/Skeleton'

export default function CategoryIconRow({ items = [], loading = false, onSelect }) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-16 flex-none">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="mt-2 h-3 w-14" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {items.map((cat) => (
        <button
          key={cat.slug || cat._id || cat.displayName}
          type="button"
          onClick={() => onSelect?.(cat)}
          className="w-16 flex-none"
        >
          <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
            {cat.imageUrl ? (
              <img
                src={cat.imageUrl}
                alt={cat.displayName}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-center text-[11px] font-medium text-slate-700">
            {cat.displayName}
          </p>
        </button>
      ))}
    </div>
  )
}

