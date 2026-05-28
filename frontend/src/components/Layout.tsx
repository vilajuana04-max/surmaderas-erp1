import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package,
  Users, Receipt, Menu, X, ChevronDown, TrendingUp, Bell, Wallet,
} from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'

const NAV_MAIN = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard', num: '01' },
  { to: '/ventas',  icon: ShoppingCart,    label: 'Ventas',    num: '02' },
  { to: '/compras', icon: Package,         label: 'Compras',   num: '03' },
]
const RRHH_SUB = [
  { tab: 'vacaciones', label: 'Vacaciones' },
  { tab: 'calendario', label: 'Calendario' },
  { tab: 'sueldos',    label: 'Sueldos'    },
  { tab: 'recibos',    label: 'Recibos'    },
  { tab: 'dashboard',  label: 'Dashboard'  },
  { tab: 'ajustes',    label: 'Ajustes'    },
]
const GASTOS_SUB = [
  { tab: 'compartidos', label: 'Compartidos' },
  { tab: 'luro',        label: 'Gastos Luro' },
]

/* ── Sidebar content (shared desktop/mobile) ─────────────────── */
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location   = useLocation()
  const isRRHH     = location.pathname === '/rrhh' || location.pathname.startsWith('/rrhh')
  const isGastos   = location.pathname === '/gastos' || location.pathname.startsWith('/gastos')
  const [rrhhOpen,   setRrhhOpen]   = useState(isRRHH)
  const [gastosOpen, setGastosOpen] = useState(isGastos)

  // Tab activo desde query params
  const activeTab = new URLSearchParams(location.search).get('tab') ?? 'vacaciones'

  const navLinkClass = (isActive: boolean) => [
    'flex items-center gap-3 px-7 py-3 text-sm font-semibold font-body',
    'border-l-[3px] transition-all duration-200 tracking-wide',
    isActive
      ? 'text-white border-l-coral bg-white/5'
      : 'text-white/40 border-l-transparent hover:text-white/80 hover:bg-white/5',
  ].join(' ')

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
        {/* Items antes de RRHH */}
        {NAV_MAIN.map(({ to, icon: Icon, label, num }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={onClose}
            className={({ isActive }) => navLinkClass(isActive)}
            style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
            <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>{num}</span>
            <Icon size={16} strokeWidth={2} />
            <span className="tracking-[1px] uppercase text-[12px]">{label}</span>
          </NavLink>
        ))}

        {/* ── RRHH con submenú desplegable ── */}
        <button
          onClick={() => setRrhhOpen(o => !o)}
          className={[
            'w-full flex items-center gap-3 px-7 py-3 text-sm font-semibold font-body',
            'border-l-[3px] transition-all duration-200 tracking-wide',
            isRRHH
              ? 'text-white bg-white/5'
              : 'text-white/40 border-l-transparent hover:text-white/80 hover:bg-white/5',
          ].join(' ')}
          style={{ borderLeftColor: isRRHH ? CORAL : 'transparent' }}>
          <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>04</span>
          <Users size={16} strokeWidth={2} />
          <span className="tracking-[1px] uppercase text-[12px] flex-1 text-left">Rec. Humanos</span>
          <ChevronDown
            size={14}
            className="transition-transform duration-200 shrink-0"
            style={{ transform: rrhhOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.6 }}
          />
        </button>

        {/* Sub-items */}
        {rrhhOpen && (
          <div className="pb-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {RRHH_SUB.map(({ tab, label }) => {
              const isActive = isRRHH && activeTab === tab
              return (
                <NavLink
                  key={tab}
                  to={`/rrhh?tab=${tab}`}
                  onClick={onClose}
                  className={[
                    'flex items-center gap-2 pl-14 pr-7 py-2 text-[11px] font-semibold font-body',
                    'border-l-[3px] transition-all duration-150',
                    isActive
                      ? 'text-white bg-white/5'
                      : 'text-white/35 border-l-transparent hover:text-white/70 hover:bg-white/5',
                  ].join(' ')}
                  style={{ borderLeftColor: isActive ? CORAL : 'transparent' }}>
                  <span className="tracking-wide">{label}</span>
                </NavLink>
              )
            })}
          </div>
        )}

        {/* ── Gastos con submenú desplegable ── */}
        <button
          onClick={() => setGastosOpen(o => !o)}
          className={[
            'w-full flex items-center gap-3 px-7 py-3 text-sm font-semibold font-body',
            'border-l-[3px] transition-all duration-200 tracking-wide',
            isGastos
              ? 'text-white bg-white/5'
              : 'text-white/40 border-l-transparent hover:text-white/80 hover:bg-white/5',
          ].join(' ')}
          style={{ borderLeftColor: isGastos ? CORAL : 'transparent' }}>
          <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>05</span>
          <Receipt size={16} strokeWidth={2} />
          <span className="tracking-[1px] uppercase text-[12px] flex-1 text-left">Gastos</span>
          <ChevronDown
            size={14}
            className="transition-transform duration-200 shrink-0"
            style={{ transform: gastosOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.6 }}
          />
        </button>

        {gastosOpen && (
          <div className="pb-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {GASTOS_SUB.map(({ tab, label }) => {
              const activeGastosTab = new URLSearchParams(location.search).get('tab') ?? 'compartidos'
              const isActive = isGastos && activeGastosTab === tab
              return (
                <NavLink
                  key={tab}
                  to={`/gastos?tab=${tab}`}
                  onClick={onClose}
                  className={[
                    'flex items-center gap-2 pl-14 pr-7 py-2 text-[11px] font-semibold font-body',
                    'border-l-[3px] transition-all duration-150',
                    isActive
                      ? 'text-white bg-white/5'
                      : 'text-white/35 border-l-transparent hover:text-white/70 hover:bg-white/5',
                  ].join(' ')}
                  style={{ borderLeftColor: isActive ? CORAL : 'transparent' }}>
                  <span className="tracking-wide">{label}</span>
                </NavLink>
              )
            })}
          </div>
        )}

        {/* ── Flujo de Caja ── */}
        <NavLink
          to="/flujocaja"
          onClick={onClose}
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
          <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>06</span>
          <TrendingUp size={16} strokeWidth={2} />
          <span className="tracking-[1px] uppercase text-[12px]">Flujo de Caja</span>
        </NavLink>

        {/* ── Vencimientos ── */}
        <NavLink
          to="/vencimientos"
          onClick={onClose}
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
          <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>07</span>
          <Bell size={16} strokeWidth={2} />
          <span className="tracking-[1px] uppercase text-[12px]">Vencimientos</span>
        </NavLink>

        {/* ── Gastos Personales ── */}
        <NavLink
          to="/gastos-personales"
          onClick={onClose}
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
          <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>08</span>
          <Wallet size={16} strokeWidth={2} />
          <span className="tracking-[1px] uppercase text-[12px]">Gastos Pers.</span>
        </NavLink>
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
