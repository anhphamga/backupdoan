import BottomNav from '../../ui/patterns/BottomNav'
import MobileTopBar from '../../ui/patterns/MobileTopBar'
import SwipeCarousel from '../../ui/patterns/SwipeCarousel'
import CategoryIconRow from '../../ui/patterns/CategoryIconRow'
import ProductGrid from '../../ui/patterns/ProductGrid'

export default function HomeMobile({
  heroBanners = [],
  categories = [],
  categoriesLoading = false,
  products = [],
  productsLoading = false,
  onSelectCategory,
  onSelectHero,
  onSelectProduct,
}) {
  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(180deg,#fffdf8_0%,#f8fafc_30%,#f8fafc_100%)] pb-20">
      <MobileTopBar />

      <main className="mx-auto max-w-lg space-y-6 px-4 py-4">
        <section className="space-y-3">
          <SwipeCarousel items={heroBanners} onSelect={onSelectHero} />
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700/80">Khám phá</p>
              <h2 className="mt-1 text-base font-semibold text-slate-950">Danh mục nổi bật</h2>
            </div>
          </div>
          <CategoryIconRow items={categories} loading={categoriesLoading} onSelect={onSelectCategory} />
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Gợi ý</p>
              <h2 className="mt-1 text-base font-semibold text-slate-950">Sản phẩm hợp trend</h2>
            </div>
          </div>
          <ProductGrid items={products} loading={productsLoading} onSelect={onSelectProduct} />
        </section>
      </main>

      <BottomNav />
    </div>
  )
}

