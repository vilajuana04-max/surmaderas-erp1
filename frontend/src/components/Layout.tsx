import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package,
  Users, Umbrella, Receipt, Menu, X,
} from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',  num: '01' },
  { to: '/ventas',     icon: ShoppingCart,    label: 'Ventas',     num: '02' },
  { to: '/compras',    icon: Package,         label: 'Compras',    num: '03' },
  { to: '/sueldos',    icon: Users,           label: 'Sueldos',    num: '04' },
  { to: '/vacaciones', icon: Umbrella,        label: 'Vacaciones', num: '05' },
  { to: '/gastos',     icon: Receipt,         label: 'Gastos',     num: '06' },
]

/* ── Sidebar content (shared desktop/mobile) ─────────────────── */
function SidebarContent({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-7 py-8 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <p style={{ color: CORAL }}
          className="text-[11px] font-bold tracking-[3px] uppercase font-body mb-1">
          Sur Maderas
        </p>
        <p className="text-white text-lg font-bold leading-tight font-head">
          Sistema ERP
        </p>
        <p className="text-white/30 text-[11px] tracking-[1.5px] uppercase mt-1.5 font-body">
          Mar del Plata · 2026
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6">
        {NAV.map(({ to, icon: Icon, label, num }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-7 py-3 text-sm font-semibold font-body',
                'border-l-[3px] transition-all duration-200 tracking-wide',
                isActive
                  ? 'text-white border-l-coral bg-white/5'
                  : 'text-white/40 border-l-transparent hover:text-white/80 hover:bg-white/5',
              ].join(' ')
            }
            style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}
          >
            <span className="font-body text-[10px] font-bold tracking-[1.5px]"
              style={{ color: CORAL }}>
              {num}
            </span>
            <Icon size={16} strokeWidth={2} />
            <span className="tracking-[1px] uppercase text-[12px]">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-7 py-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="text-white/20 text-[10px] font-body tracking-wide uppercase">
          v1.0 · Sistema interno
        </p>
      </div>
    </div>
  )
}

/* ── Layout principal ────────────────────────────────────────── */
export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex" style={{ background: '#f8f7f5' }}>

      {/* ── SIDEBAR DESKTOP ── */}
      <aside
        className="hidden md:flex flex-col w-60 flex-shrink-0 sticky top-0 h-screen overflow-y-auto"
        style={{ background: NAVY }}>
        <SidebarContent />
      </aside>

      {/* ── MOBILE HAMBURGER ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
        style={{ background: CORAL }}>
        <Menu size={20} color="white" />
      </button>

      {/* ── MOBILE DRAWER ── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <aside
            className="md:hidden fixed top-0 left-0 h-full w-64 z-50 overflow-y-auto flex flex-col"
            style={{ background: NAVY }}>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white">
              <X size={20} />
            </button>
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {/* Top bar mobile — spacer so content doesn't hide under hamburger */}
        <div className="md:hidden h-16" />

        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>

    </div>
  )
}
