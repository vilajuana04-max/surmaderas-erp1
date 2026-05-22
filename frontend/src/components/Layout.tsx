import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Umbrella, Receipt, ChevronLeft,
} from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/ventas',     icon: ShoppingCart,    label: 'Ventas'     },
  { to: '/compras',    icon: Package,         label: 'Compras'    },
  { to: '/sueldos',    icon: Users,           label: 'Sueldos'    },
  { to: '/vacaciones', icon: Umbrella,        label: 'Vacaciones' },
  { to: '/gastos',     icon: Receipt,         label: 'Gastos'     },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar — mobile */}
      <header className="sticky top-0 z-30 bg-wood-800 text-white shadow-lg md:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-2xl">🌲</span>
          <div>
            <p className="font-bold text-sm leading-none">SUR MADERAS</p>
            <p className="text-wood-400 text-[10px]">Sistema ERP</p>
          </div>
        </div>
        {/* Mobile nav — horizontal scroll */}
        <nav className="flex overflow-x-auto gap-1 px-2 pb-2 scrollbar-none">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              className={({ isActive }) => clsx(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] whitespace-nowrap transition-colors',
                isActive ? 'bg-wood-500 text-white' : 'text-wood-300 hover:bg-wood-700'
              )}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="flex flex-1">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex flex-col w-56 bg-wood-800 text-white min-h-screen sticky top-0 h-screen">
          <div className="px-5 py-6 border-b border-wood-700">
            <p className="font-bold text-lg tracking-wide">SUR MADERAS</p>
            <p className="text-wood-400 text-xs mt-0.5">Sistema ERP v1.0</p>
          </div>
          <nav className="flex flex-col gap-1 p-3 flex-1">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to} to={to} end={to === '/'}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                  isActive ? 'bg-wood-500 text-white font-semibold' : 'text-wood-300 hover:bg-wood-700 hover:text-white'
                )}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="px-5 py-4 border-t border-wood-700 text-wood-500 text-[10px]">
            Mar del Plata · 2026
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-x-hidden">
          <div className="max-w-5xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
