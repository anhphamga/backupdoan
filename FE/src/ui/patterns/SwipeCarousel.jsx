import { useEffect, useMemo, useRef, useState } from 'react'

export default function SwipeCarousel({ items = [], autoMs = 4500, onSelect }) {
  const containerRef = useRef(null)
  const [index, setIndex] = useState(0)

  const canAuto = useMemo(() => items.length > 1 && autoMs > 0, [autoMs, items.length])

  useEffect(() => {
    if (!canAuto) return
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length)
    }, autoMs)
    return () => window.clearInterval(timer)
  }, [autoMs, canAuto, items.length])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }, [index])

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-2xl"
        onScroll={(e) => {
          const el = e.currentTarget
          const nextIndex = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
          if (Number.isFinite(nextIndex)) setIndex(nextIndex)
        }}
      >
        {items.map((item) => (
          <button
            key={item._id || item.id}
            type="button"
            className="relative w-full flex-none snap-center overflow-hidden rounded-2xl"
            onClick={() => onSelect?.(item)}
          >
            <div className="aspect-[16/9] w-full bg-slate-100">
              <img
                src={item.imageUrl}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.72))] p-3 text-left">
              <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
              {item.subtitle ? <p className="mt-1 text-xs text-white/85 line-clamp-1">{item.subtitle}</p> : null}
            </div>
          </button>
        ))}
      </div>
      {items.length > 1 ? (
        <div className="flex items-center justify-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-amber-500' : 'w-1.5 bg-slate-300'}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

