import { NavLink } from 'react-router-dom'
import { Home, Shirt, ShoppingBag, ShoppingCart, User } from 'lucide-react'

const items = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/buy?purpose=rent', label: 'Thuê', Icon: Shirt },
  { to: '/buy', label: 'Mua', Icon: ShoppingBag },
  { to: '/cart', label: 'Giỏ', Icon: ShoppingCart },
  { to: '/profile', label: 'Tôi', Icon: User },
]

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-5 px-2 py-2">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] transition ${
                isActive ? 'text-slate-950' : 'text-slate-500'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

