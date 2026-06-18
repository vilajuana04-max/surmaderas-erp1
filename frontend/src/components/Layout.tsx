import React, { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Receipt, Menu, X, ChevronDown, Bell, Wallet, LogOut,
  BookOpen, Ticket, Contact, CalendarRange, ImagePlay,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAVY  = '#070614'
const CORAL = '#C8603A'

const RRHH_SUB = [
  { tab: 'vacaciones', label: 'Vacaciones' },
  { tab: 'calendario', label: 'Calendario' },
  { tab: 'sueldos',    label: 'Sueldos'    },
  { tab: 'recibos',    label: 'Recibos'    },
  { tab: 'dashboard',  label: 'Dashboard'  },
  { tab: 'puestos',    label: 'Puestos'    },
  { tab: 'ajustes',    label: 'Ajustes'    },
]

/* ── Sidebar content (shared desktop/mobile) ─────────────────── */
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location   = useLocation()
  const navigate   = useNavigate()
  const { user, logout } = useAuth()
  const isAdmin      = user?.role === 'admin'
  const isCajaDiaria = user?.role === 'caja_diaria'
  const canSeeCupones = isAdmin || isCajaDiaria

  const p = location.pathname
  const isFinanzas = ['/ventas','/compras','/gastos','/flujocaja','/punto-equilibrio'].some(x => p === x || p.startsWith(x))
  const isRRHH     = p.startsWith('/rrhh') || p.startsWith('/comisiones')
  const isClientes = p.startsWith('/cupones') || p.startsWith('/clientes')

  const [finanzasOpen, setFinanzasOpen] = useState(isFinanzas)
  const [rrhhOpen,     setRrhhOpen]     = useState(isRRHH)
  const [clientesOpen, setClientesOpen] = useState(isClientes)

  const activeTab = new URLSearchParams(location.search).get('tab') ?? 'vacaciones'

  const navLinkClass = (isActive: boolean) => [
    'flex items-center gap-3 px-7 py-3 text-sm font-semibold font-body',
    'border-l-[3px] transition-all duration-200 tracking-wide',
    isActive
      ? 'text-white border-l-coral bg-white/5'
      : 'text-white/40 border-l-transparent hover:text-white/80 hover:bg-white/5',
  ].join(' ')

  // Botón de grupo (parent colapsable)
  const groupBtnClass = (active: boolean) => [
    'w-full flex items-center gap-3 px-7 py-3 text-sm font-semibold font-body',
    'border-l-[3px] transition-all duration-200 tracking-wide',
    active ? 'text-white bg-white/5' : 'text-white/40 border-l-transparent hover:text-white/80 hover:bg-white/5',
  ].join(' ')
  // Ítem de submenú
  const subLinkClass = (active: boolean) => [
    'flex items-center gap-2 pl-14 pr-7 py-2 text-[11px] font-semibold font-body',
    'border-l-[3px] transition-all duration-150',
    active ? 'text-white bg-white/5' : 'text-white/35 border-l-transparent hover:text-white/70 hover:bg-white/5',
  ].join(' ')
  const activeGastosTab = new URLSearchParams(location.search).get('tab') ?? 'compartidos'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-7 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
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

        {/* User chip */}
        {user && (
          <div className="mt-4 flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
              style={{ background: CORAL }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-[11px] font-semibold leading-none truncate">
                {user.username}
              </p>
              <p className="text-white/30 text-[10px] tracking-wide uppercase mt-0.5">
                {user.role === 'admin' ? 'Administrador' : user.role === 'caja_diaria' ? 'Caja Diaria' : 'Acceso Caja'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 overflow-y-auto">
        {/* ── Dashboard ── */}
        {!isCajaDiaria && (
          <NavLink to="/" end onClick={onClose}
            className={({ isActive }) => navLinkClass(isActive)}
            style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
            <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>01</span>
            <LayoutDashboard size={16} strokeWidth={2} />
            <span className="tracking-[1px] uppercase text-[12px]">Dashboard</span>
          </NavLink>
        )}

        {/* ── Caja Diaria — todos ── */}
        <NavLink to="/caja-diaria" onClick={onClose}
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
          <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>02</span>
          <BookOpen size={16} strokeWidth={2} />
          <span className="tracking-[1px] uppercase text-[12px]">Caja Diaria</span>
        </NavLink>

        {/* ── FINANZAS (grupo) ── */}
        {!isCajaDiaria && (
          <>
            <button onClick={() => setFinanzasOpen(o => !o)} className={groupBtnClass(isFinanzas)}
              style={{ borderLeftColor: isFinanzas ? CORAL : 'transparent' }}>
              <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>03</span>
              <Wallet size={16} strokeWidth={2} />
              <span className="tracking-[1px] uppercase text-[12px] flex-1 text-left">Finanzas</span>
              <ChevronDown size={14} className="shrink-0 transition-transform duration-200"
                style={{ transform: finanzasOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.6 }} />
            </button>
            {finanzasOpen && (
              <div className="pb-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <NavLink to="/ventas" onClick={onClose} className={subLinkClass(p === '/ventas')}
                  style={{ borderLeftColor: p === '/ventas' ? CORAL : 'transparent' }}><span>Ventas</span></NavLink>
                <NavLink to="/compras" onClick={onClose} className={subLinkClass(p === '/compras')}
                  style={{ borderLeftColor: p === '/compras' ? CORAL : 'transparent' }}><span>Compras</span></NavLink>
                {isAdmin && <>
                  <NavLink to="/gastos?tab=compartidos" onClick={onClose}
                    className={subLinkClass(p.startsWith('/gastos') && activeGastosTab === 'compartidos')}
                    style={{ borderLeftColor: p.startsWith('/gastos') && activeGastosTab === 'compartidos' ? CORAL : 'transparent' }}><span>Gastos Compartidos</span></NavLink>
                  <NavLink to="/gastos?tab=luro" onClick={onClose}
                    className={subLinkClass(p.startsWith('/gastos') && activeGastosTab === 'luro')}
                    style={{ borderLeftColor: p.startsWith('/gastos') && activeGastosTab === 'luro' ? CORAL : 'transparent' }}><span>Gastos Luro</span></NavLink>
                  <NavLink to="/flujocaja" onClick={onClose} className={subLinkClass(p.startsWith('/flujocaja'))}
                    style={{ borderLeftColor: p.startsWith('/flujocaja') ? CORAL : 'transparent' }}><span>Flujo de Caja</span></NavLink>
                  <NavLink to="/punto-equilibrio" onClick={onClose} className={subLinkClass(p.startsWith('/punto-equilibrio'))}
                    style={{ borderLeftColor: p.startsWith('/punto-equilibrio') ? CORAL : 'transparent' }}><span>Punto de Equilibrio</span></NavLink>
                </>}
              </div>
            )}
          </>
        )}

        {/* ── RECURSOS HUMANOS (grupo) — admin ── */}
        {isAdmin && (
          <>
            <button onClick={() => setRrhhOpen(o => !o)} className={groupBtnClass(isRRHH)}
              style={{ borderLeftColor: isRRHH ? CORAL : 'transparent' }}>
              <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>04</span>
              <Users size={16} strokeWidth={2} />
              <span className="tracking-[1px] uppercase text-[12px] flex-1 text-left">Rec. Humanos</span>
              <ChevronDown size={14} className="shrink-0 transition-transform duration-200"
                style={{ transform: rrhhOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.6 }} />
            </button>
            {rrhhOpen && (
              <div className="pb-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
                {RRHH_SUB.map(({ tab, label }) => {
                  const active = p.startsWith('/rrhh') && activeTab === tab
                  return (
                    <NavLink key={tab} to={`/rrhh?tab=${tab}`} onClick={onClose} className={subLinkClass(active)}
                      style={{ borderLeftColor: active ? CORAL : 'transparent' }}><span>{label}</span></NavLink>
                  )
                })}
                <NavLink to="/comisiones" onClick={onClose} className={subLinkClass(p.startsWith('/comisiones'))}
                  style={{ borderLeftColor: p.startsWith('/comisiones') ? CORAL : 'transparent' }}><span>Comisiones</span></NavLink>
              </div>
            )}
          </>
        )}

        {/* ── Vencimientos — admin ── */}
        {isAdmin && (
          <NavLink to="/vencimientos" onClick={onClose} className={({ isActive }) => navLinkClass(isActive)}
            style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
            <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>05</span>
            <Bell size={16} strokeWidth={2} />
            <span className="tracking-[1px] uppercase text-[12px]">Vencimientos</span>
          </NavLink>
        )}

        {/* ── Gastos Personales — admin ── */}
        {isAdmin && (
          <NavLink to="/gastos-personales" onClick={onClose} className={({ isActive }) => navLinkClass(isActive)}
            style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
            <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>06</span>
            <Receipt size={16} strokeWidth={2} />
            <span className="tracking-[1px] uppercase text-[12px]">Gastos Pers.</span>
          </NavLink>
        )}

        {/* ── CLIENTES (grupo) — admin y caja_diaria ── */}
        {canSeeCupones && (
          <>
            <button onClick={() => setClientesOpen(o => !o)} className={groupBtnClass(isClientes)}
              style={{ borderLeftColor: isClientes ? CORAL : 'transparent' }}>
              <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>07</span>
              <Contact size={16} strokeWidth={2} />
              <span className="tracking-[1px] uppercase text-[12px] flex-1 text-left">Clientes</span>
              <ChevronDown size={14} className="shrink-0 transition-transform duration-200"
                style={{ transform: clientesOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.6 }} />
            </button>
            {clientesOpen && (
              <div className="pb-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <NavLink to="/cupones" onClick={onClose} className={subLinkClass(p.startsWith('/cupones'))}
                  style={{ borderLeftColor: p.startsWith('/cupones') ? CORAL : 'transparent' }}>
                  <Ticket size={13} /> <span>Cupones</span></NavLink>
                <NavLink to="/clientes" onClick={onClose} className={subLinkClass(p.startsWith('/clientes'))}
                  style={{ borderLeftColor: p.startsWith('/clientes') ? CORAL : 'transparent' }}>
                  <Contact size={13} /> <span>Base de datos</span></NavLink>
              </div>
            )}
          </>
        )}

        {/* ── Marketing — admin ── */}
        {isAdmin && (
          <NavLink to="/marketing" onClick={onClose} className={({ isActive }) => navLinkClass(isActive)}
            style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
            <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>08</span>
            <CalendarRange size={16} strokeWidth={2} />
            <span className="tracking-[1px] uppercase text-[12px]">Marketing</span>
          </NavLink>
        )}

        {/* ── Contenido — admin ── */}
        {isAdmin && (
          <NavLink to="/contenido" onClick={onClose} className={({ isActive }) => navLinkClass(isActive)}
            style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
            <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>09</span>
            <ImagePlay size={16} strokeWidth={2} />
            <span className="tracking-[1px] uppercase text-[12px]">Contenido</span>
          </NavLink>
        )}
      </nav>


      {/* Footer — logout */}
      <div className="px-7 py-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-white/30 hover:text-white/70 transition-colors text-[11px] font-body tracking-wide uppercase w-full"
        >
          <LogOut size={13} />
          Cerrar sesión
        </button>
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
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)} />
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
        <div className="md:hidden h-16" />
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>

    </div>
  )
}
