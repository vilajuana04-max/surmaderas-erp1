import { useState, useEffect } from 'react'
import {
  Calculator, Users, ClipboardList, Settings2,
  TrendingUp, Award, ChevronDown, ChevronUp, Plus, Check, X,
} from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'

// ── Types ─────────────────────────────────────────────────────────
type VentaQ = { quincena: string; monto: number }   // "2026-Q1-1" = año Q num 1|2

type Vendedor = {
  id: number
  nombre: string
  sucursal: 'luro' | 'independencia'
  horas: string
  activo: boolean
  ventas: VentaQ[]
}

type Reunion = {
  id: number
  vendedorId: number
  quincena: string
  checks: boolean[]
  notas: string
  realizada: boolean
}

type Config = {
  e1_desde: number; e1_pct: number
  e2_desde: number; e2_pct: number
  e3_desde: number; e3_pct: number
}

const CHECKLIST_ITEMS = [
  'Revisión de ventas de la quincena',
  'Logros destacados del período',
  'Puntos a mejorar',
  'Objetivos para la próxima quincena',
  'Consultas del vendedor',
]

// ── Defaults ──────────────────────────────────────────────────────
const DEFAULT_CONFIG: Config = {
  e1_desde: 4_000_000, e1_pct: 0.5,
  e2_desde: 5_000_000, e2_pct: 1.0,
  e3_desde: 7_000_000, e3_pct: 1.5,
}

const DEFAULT_VENDEDORES: Vendedor[] = [
  {
    id: 1, nombre: 'María G.', sucursal: 'luro',
    horas: '5-7hs', activo: true,
    ventas: [
      { quincena: '2026-Q1-1', monto: 4_800_000 },
      { quincena: '2026-Q1-2', monto: 5_200_000 },
      { quincena: '2026-Q2-1', monto: 6_100_000 },
      { quincena: '2026-Q2-2', monto: 3_900_000 },
      { quincena: '2026-Q3-1', monto: 5_500_000 },
    ],
  },
  {
    id: 2, nombre: 'Lucas T.', sucursal: 'independencia',
    horas: '5-7hs', activo: true,
    ventas: [
      { quincena: '2026-Q1-1', monto: 5_100_000 },
      { quincena: '2026-Q1-2', monto: 7_300_000 },
      { quincena: '2026-Q2-1', monto: 6_800_000 },
      { quincena: '2026-Q2-2', monto: 5_000_000 },
      { quincena: '2026-Q3-1', monto: 7_800_000 },
    ],
  },
  {
    id: 3, nombre: 'Ana P.', sucursal: 'luro',
    horas: '5-7hs', activo: true,
    ventas: [
      { quincena: '2026-Q1-1', monto: 3_500_000 },
      { quincena: '2026-Q1-2', monto: 4_100_000 },
      { quincena: '2026-Q2-1', monto: 4_600_000 },
      { quincena: '2026-Q2-2', monto: 3_800_000 },
      { quincena: '2026-Q3-1', monto: 4_900_000 },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────
const fmt  = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtM = (n: number) => '$' + (n / 1_000_000).toFixed(1) + 'M'

function calcComision(ventas: number, cfg: Config) {
  if (ventas >= cfg.e3_desde) return { comision: ventas * cfg.e3_pct / 100, pct: cfg.e3_pct, escala: 3 }
  if (ventas >= cfg.e2_desde) return { comision: ventas * cfg.e2_pct / 100, pct: cfg.e2_pct, escala: 2 }
  if (ventas >= cfg.e1_desde) return { comision: ventas * cfg.e1_pct / 100, pct: cfg.e1_pct, escala: 1 }
  return { comision: 0, pct: 0, escala: 0 }
}

function currentQuincena() {
  const now = new Date()
  const m   = now.getMonth() + 1
  const q   = now.getDate() <= 15 ? 1 : 2
  return `${now.getFullYear()}-M${String(m).padStart(2,'0')}-Q${q}`
}

function labelQuincena(q: string) {
  const m = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const parts = q.split('-')
  // formato: "2026-M05-Q1" → "1ra quincena Mayo 2026"
  if (parts.length === 3) {
    const año  = parts[0]
    const mes  = parseInt(parts[1].replace('M','')) - 1
    const num  = parts[2].replace('Q','')
    return `${num === '1' ? '1ra' : '2da'} quincena ${m[mes] ?? ''} ${año}`
  }
  return q
}

// ── localStorage ──────────────────────────────────────────────────
function useLocalState<T>(key: string, def: T) {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def }
    catch { return def }
  })
  function set(v: T) { setVal(v); localStorage.setItem(key, JSON.stringify(v)) }
  return [val, set] as const
}

// ═══════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════
type Tab = 'calculadora' | 'vendedores' | 'reuniones' | 'config'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'calculadora', label: 'Calculadora', icon: <Calculator size={14}/> },
  { id: 'vendedores',  label: 'Vendedores',  icon: <Users size={14}/> },
  { id: 'reuniones',   label: 'Reuniones',   icon: <ClipboardList size={14}/> },
  { id: 'config',      label: 'Config',      icon: <Settings2 size={14}/> },
]

// ═══════════════════════════════════════════════════════════════════
// CALCULADORA
// ═══════════════════════════════════════════════════════════════════
function TabCalculadora({ vendedores, cfg }: { vendedores: Vendedor[]; cfg: Config }) {
  const [vendId, setVendId] = useState(vendedores[0]?.id ?? 0)
  const [input,  setInput]  = useState('')

  const ventas = parseFloat(input.replace(/\./g, '').replace(',', '.')) || 0
  const { comision, pct, escala } = calcComision(ventas, cfg)

  const max  = cfg.e3_desde * 1.4
  const barE1 = Math.min(cfg.e1_desde, ventas) / max * 100
  const barE2 = Math.max(0, Math.min(cfg.e2_desde - cfg.e1_desde, ventas - cfg.e1_desde)) / max * 100
  const barE3 = Math.max(0, Math.min(cfg.e3_desde - cfg.e2_desde, ventas - cfg.e2_desde)) / max * 100
  const barE4 = Math.max(0, ventas - cfg.e3_desde) / max * 100

  const falta =
    escala === 0 ? null
    : escala === 1 ? fmt(cfg.e2_desde - ventas) + ' para Escala 2'
    : escala === 2 ? fmt(cfg.e3_desde - ventas) + ' para Escala 3'
    : '🏆 ¡Máxima escala!'

  return (
    <div className="space-y-4">
      {/* Selector vendedor */}
      <div>
        <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-2">Vendedor</p>
        <div className="flex flex-wrap gap-2">
          {vendedores.filter(v => v.activo).map(v => (
            <button key={v.id}
              onClick={() => setVendId(v.id)}
              className="px-4 py-1.5 rounded-full text-sm font-bold transition-all border-2"
              style={vendId === v.id
                ? { background: NAVY, color: 'white', borderColor: NAVY }
                : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}>
              {v.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Input ventas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-3">
          Ventas cobradas en la quincena
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold" style={{ color: CORAL }}>$</span>
          <input
            type="text"
            inputMode="numeric"
            value={input}
            onChange={e => setInput(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            className="flex-1 text-3xl font-bold text-gray-800 outline-none bg-transparent"
          />
        </div>

        {/* Barra escala */}
        <div className="mt-4 h-2.5 rounded-full overflow-hidden flex gap-px bg-gray-100">
          {barE1 > 0 && <div style={{ flex: barE1, background: '#d1d5db' }} />}
          {barE2 > 0 && <div style={{ flex: barE2, background: '#f59e0b' }} />}
          {barE3 > 0 && <div style={{ flex: barE3, background: CORAL }} />}
          {barE4 > 0 && <div style={{ flex: barE4, background: NAVY }} />}
          <div style={{ flex: Math.max(0, 100 - barE1 - barE2 - barE3 - barE4), background: '#f3f4f6' }} />
        </div>

        {/* Leyenda escalas */}
        <div className="flex gap-3 mt-2 flex-wrap">
          {[
            { color: '#d1d5db', label: `Piso ${fmtM(cfg.e1_desde)}` },
            { color: '#f59e0b', label: `Esc.1 ${cfg.e1_pct}%` },
            { color: CORAL,    label: `Esc.2 ${cfg.e2_pct}%` },
            { color: NAVY,     label: `Esc.3 ${cfg.e3_pct}%` },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sin alcanzar el piso */}
      {ventas > 0 && escala === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-red-600">
            ⚠️ No alcanza el piso mínimo
          </p>
          <p className="text-sm text-red-500 mt-1">
            Faltan <strong>{fmt(cfg.e1_desde - ventas)}</strong> para empezar a ganar comisión
            (piso: {fmtM(cfg.e1_desde)})
          </p>
        </div>
      )}

      {/* Resultados */}
      {ventas > 0 && escala > 0 && (
        <>
          {/* Badge escala */}
          <div className="flex">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
              style={
                escala === 3 ? { background: NAVY + '15', color: NAVY }
                : escala === 2 ? { background: CORAL + '18', color: CORAL }
                : { background: '#fef3c7', color: '#92400e' }
              }>
              <Award size={14}/>
              {escala === 1 ? `Escala 1 — ${cfg.e1_pct}%`
               : escala === 2 ? `Escala 2 — ${cfg.e2_pct}%`
               : `Escala 3 — ${cfg.e3_pct}% 🏆`}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">Comisión</p>
              <p className="text-2xl font-bold" style={{ color: CORAL }}>{fmt(comision)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">% aplicado</p>
              <p className="text-2xl font-bold" style={{ color: NAVY }}>{pct}%</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">Ventas ingresadas</p>
              <p className="text-lg font-bold text-gray-700">{fmt(ventas)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">Siguiente escala</p>
              <p className="text-sm font-bold text-gray-700">{falta}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// VENDEDORES
// ═══════════════════════════════════════════════════════════════════
function TabVendedores({
  vendedores, setVendedores, cfg,
}: {
  vendedores: Vendedor[]
  setVendedores: (v: Vendedor[]) => void
  cfg: Config
}) {
  const [adding, setAdding] = useState(false)
  const [nombre, setNombre] = useState('')
  const [suc, setSuc]       = useState<'luro'|'independencia'>('luro')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [ventaInput, setVentaInput] = useState('')

  function addVendedor() {
    if (!nombre.trim()) return
    const nuevo: Vendedor = {
      id: Date.now(), nombre: nombre.trim(),
      sucursal: suc, horas: '5-7hs', activo: true, ventas: [],
    }
    setVendedores([...vendedores, nuevo])
    setNombre(''); setAdding(false)
  }

  function addVenta(id: number) {
    const monto = parseFloat(ventaInput.replace(/\./g, '').replace(',', '.')) || 0
    if (!monto) return
    setVendedores(vendedores.map(v =>
      v.id === id
        ? { ...v, ventas: [...v.ventas, { quincena: currentQuincena(), monto }] }
        : v
    ))
    setVentaInput('')
  }

  function toggleActivo(id: number) {
    setVendedores(vendedores.map(v => v.id === id ? { ...v, activo: !v.activo } : v))
  }

  return (
    <div className="space-y-3">
      {vendedores.map(v => {
        const ult = v.ventas[v.ventas.length - 1]?.monto ?? 0
        const prom = v.ventas.length
          ? v.ventas.reduce((a, b) => a + b.monto, 0) / v.ventas.length
          : 0
        const { comision, pct, escala } = calcComision(ult, cfg)
        const barPct = Math.min(100, ult / cfg.e3_desde * 100)
        const isOpen = expanded === v.id

        return (
          <div key={v.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setExpanded(isOpen ? null : v.id)}
              className="w-full px-5 py-4 flex items-center gap-3 text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-800">{v.nombre}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: v.sucursal === 'luro' ? CORAL + '18' : NAVY + '12',
                             color: v.sucursal === 'luro' ? CORAL : NAVY }}>
                    {v.sucursal === 'luro' ? 'Luro' : 'Independencia'}
                  </span>
                  {!v.activo && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-semibold">
                      Inactivo
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{v.horas} · {v.ventas.length} quincenas</p>

                {/* Mini barra */}
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${barPct}%`,
                             background: escala === 3 ? NAVY : escala >= 1 ? CORAL : '#d1d5db' }} />
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-lg font-bold" style={{ color: escala > 0 ? CORAL : '#9ca3af' }}>
                  {fmt(comision)}
                </p>
                <p className="text-xs text-gray-400">{escala > 0 ? `Esc.${escala} · ${pct}%` : 'Sin comisión'}</p>
              </div>

              {isOpen ? <ChevronUp size={16} className="text-gray-300 shrink-0"/> : <ChevronDown size={16} className="text-gray-300 shrink-0"/>}
            </button>

            {/* Detalle expandido */}
            {isOpen && (
              <div className="border-t border-gray-100 px-5 pb-4 pt-3 space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Última quincena', value: fmtM(ult) },
                    { label: 'Promedio',         value: fmtM(prom) },
                    { label: 'Comisión',         value: fmt(comision) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-sm font-bold text-gray-700 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Historial últimas 5 quincenas */}
                {v.ventas.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-2">
                      Historial
                    </p>
                    <div className="space-y-1">
                      {[...v.ventas].reverse().slice(0, 5).map((vq, i) => {
                        const { escala: e } = calcComision(vq.monto, cfg)
                        return (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400 text-xs w-28 shrink-0">
                              {labelQuincena(vq.quincena)}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{ width: `${Math.min(100, vq.monto / cfg.e3_desde * 100)}%`,
                                         background: e === 3 ? NAVY : e >= 1 ? CORAL : '#d1d5db' }} />
                            </div>
                            <span className="font-semibold text-gray-600 text-xs w-20 text-right shrink-0">
                              {fmtM(vq.monto)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Agregar venta */}
                <div>
                  <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-2">
                    Registrar quincena
                  </p>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 flex-1 border border-gray-200 rounded-xl px-3 py-2">
                      <span className="text-sm font-bold" style={{ color: CORAL }}>$</span>
                      <input
                        type="text" inputMode="numeric"
                        value={ventaInput}
                        onChange={e => setVentaInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                        placeholder="Ventas de la quincena"
                        className="flex-1 text-sm outline-none bg-transparent"
                      />
                    </div>
                    <button
                      onClick={() => addVenta(v.id)}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                      style={{ background: NAVY }}>
                      Agregar
                    </button>
                  </div>
                </div>

                {/* Toggle activo */}
                <div className="flex justify-end">
                  <button
                    onClick={() => toggleActivo(v.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                    {v.activo ? 'Desactivar vendedor' : 'Activar vendedor'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Agregar vendedor */}
      {adding ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="font-bold text-gray-700 text-sm">Nuevo vendedor</p>
          <input
            type="text" value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
            autoFocus
          />
          <div className="flex gap-2">
            {(['luro', 'independencia'] as const).map(s => (
              <button key={s}
                onClick={() => setSuc(s)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                style={suc === s
                  ? { background: NAVY, color: 'white', borderColor: NAVY }
                  : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                {s === 'luro' ? 'Luro' : 'Independencia'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addVendedor}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: CORAL }}>
              <Check size={14} className="inline mr-1"/> Agregar
            </button>
            <button onClick={() => { setAdding(false); setNombre('') }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200">
              <X size={14} className="inline mr-1"/> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 rounded-2xl text-sm font-bold border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all flex items-center justify-center gap-2">
          <Plus size={14}/> Agregar vendedor
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// REUNIONES
// ═══════════════════════════════════════════════════════════════════
function TabReuniones({
  vendedores, reuniones, setReuniones, cfg,
}: {
  vendedores: Vendedor[]
  reuniones: Reunion[]
  setReuniones: (r: Reunion[]) => void
  cfg: Config
}) {
  const qActual = currentQuincena()

  // Crear reunión si no existe
  function ensureReunion(vendId: number): Reunion {
    const existing = reuniones.find(r => r.vendedorId === vendId && r.quincena === qActual)
    if (existing) return existing
    const nueva: Reunion = {
      id: Date.now() + vendId,
      vendedorId: vendId,
      quincena: qActual,
      checks: CHECKLIST_ITEMS.map(() => false),
      notas: '',
      realizada: false,
    }
    setReuniones([...reuniones, nueva])
    return nueva
  }

  function updateReunion(updated: Reunion) {
    setReuniones(reuniones.map(r =>
      r.vendedorId === updated.vendedorId && r.quincena === updated.quincena ? updated : r
    ))
  }

  const activos = vendedores.filter(v => v.activo)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-3">
        <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400">Quincena actual</p>
        <p className="font-bold text-gray-700 mt-0.5">{labelQuincena(qActual)}</p>
      </div>

      {activos.map(v => {
        const r    = reuniones.find(r => r.vendedorId === v.id && r.quincena === qActual)
        const ult  = v.ventas[v.ventas.length - 1]?.monto ?? 0
        const { comision, pct } = calcComision(ult, cfg)
        const done = r?.checks.filter(Boolean).length ?? 0

        return (
          <div key={v.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-100"
              style={{ background: r?.realizada ? '#f0fdf4' : 'white' }}>
              <div>
                <p className="font-bold text-gray-800">{v.nombre}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Comisión: <span className="font-bold" style={{ color: CORAL }}>{fmt(comision)}</span>
                  {' '}&middot; {pct > 0 ? `Escala ${pct}%` : 'Sin comisión'}
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full shrink-0"
                style={r?.realizada
                  ? { background: '#dcfce7', color: '#16a34a' }
                  : { background: '#fef9c3', color: '#854d0e' }}>
                {r?.realizada ? '✓ Realizada' : 'Pendiente'}
              </span>
            </div>

            <div className="px-5 pb-4 pt-3 space-y-3">
              {/* Checklist */}
              <div className="space-y-2">
                {CHECKLIST_ITEMS.map((item, i) => {
                  const checked = r?.checks[i] ?? false
                  function toggle() {
                    const reunion = r ?? ensureReunion(v.id)
                    const newChecks = [...reunion.checks]
                    newChecks[i] = !newChecks[i]
                    updateReunion({ ...reunion, checks: newChecks })
                  }
                  return (
                    <button key={i} onClick={toggle}
                      className="w-full flex items-center gap-3 text-left py-1.5 border-b border-gray-50 last:border-0">
                      <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                        style={checked
                          ? { background: CORAL, borderColor: CORAL }
                          : { borderColor: '#e5e7eb' }}>
                        {checked && <Check size={11} color="white" strokeWidth={3}/>}
                      </div>
                      <span className={`text-sm ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {item}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Progreso */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${done / CHECKLIST_ITEMS.length * 100}%`, background: CORAL }} />
                </div>
                <span className="text-xs text-gray-400">{done}/{CHECKLIST_ITEMS.length}</span>
              </div>

              {/* Notas */}
              <textarea
                value={r?.notas ?? ''}
                onChange={e => {
                  const reunion = r ?? ensureReunion(v.id)
                  updateReunion({ ...reunion, notas: e.target.value })
                }}
                placeholder="Notas de la reunión…"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none resize-none focus:border-gray-400 placeholder:text-gray-300"
              />

              {/* Botón marcar realizada */}
              <button
                onClick={() => {
                  const reunion = r ?? ensureReunion(v.id)
                  updateReunion({ ...reunion, realizada: !reunion.realizada })
                }}
                className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                style={r?.realizada
                  ? { background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb' }
                  : { background: NAVY, color: 'white' }}>
                {r?.realizada ? '↩ Reabrir reunión' : '✓ Marcar como realizada'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════
function TabConfig({ cfg, setCfg }: { cfg: Config; setCfg: (c: Config) => void }) {
  const [local, setLocal] = useState(cfg)
  const [saved, setSaved]  = useState(false)

  function save() {
    setCfg(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const rows: { label: string; sub?: string; key: keyof Config }[] = [
    { label: 'Piso mínimo (Escala 1 desde)',     sub: 'Monto mínimo para ganar comisión',  key: 'e1_desde' },
    { label: '% Escala 1',                       sub: `De ${fmtM(local.e1_desde)} a ${fmtM(local.e2_desde)}`, key: 'e1_pct'   },
    { label: 'Escala 2 desde',                   sub: 'Segundo escalón',                   key: 'e2_desde' },
    { label: '% Escala 2',                       sub: `De ${fmtM(local.e2_desde)} a ${fmtM(local.e3_desde)}`, key: 'e2_pct'   },
    { label: 'Escala 3 desde',                   sub: 'Tercer escalón (máximo)',            key: 'e3_desde' },
    { label: '% Escala 3',                       sub: `Desde ${fmtM(local.e3_desde)} en adelante`,  key: 'e3_pct'   },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100" style={{ background: NAVY }}>
          <p className="text-white/60 text-[11px] font-bold tracking-[2px] uppercase">Escalas de comisión</p>
        </div>
        {rows.map(({ label, sub, key }) => (
          <div key={key} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700">{label}</p>
              {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
            <input
              type="number"
              value={local[key]}
              onChange={e => setLocal({ ...local, [key]: parseFloat(e.target.value) || 0 })}
              className="w-32 text-right text-sm font-bold border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-gray-400"
            />
          </div>
        ))}
      </div>

      {/* Preview escalas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-3">Vista previa</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Sin comisión</span>
            <span className="text-gray-400">menos de {fmtM(local.e1_desde)}</span>
          </div>
          {[
            { label: 'Escala 1', desde: local.e1_desde, hasta: local.e2_desde, pct: local.e1_pct, color: '#f59e0b' },
            { label: 'Escala 2', desde: local.e2_desde, hasta: local.e3_desde, pct: local.e2_pct, color: CORAL },
            { label: 'Escala 3', desde: local.e3_desde, hasta: null,           pct: local.e3_pct, color: NAVY },
          ].map(({ label, desde, hasta, pct, color }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="font-semibold" style={{ color }}>{label} — {pct}%</span>
              <span className="text-gray-400 text-xs">
                {fmtM(desde)} {hasta ? `→ ${fmtM(hasta)}` : 'en adelante'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={save}
        className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all"
        style={{ background: saved ? '#16a34a' : CORAL }}>
        {saved ? '✓ Guardado' : 'Guardar configuración'}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════
export default function Comisiones() {
  const [tab, setTab]                 = useState<Tab>('calculadora')
  const [cfg, setCfg]                 = useLocalState<Config>('comisiones_cfg', DEFAULT_CONFIG)
  const [vendedores, setVendedores]   = useLocalState<Vendedor[]>('comisiones_vendedores', DEFAULT_VENDEDORES)
  const [reuniones, setReuniones]     = useLocalState<Reunion[]>('comisiones_reuniones', [])

  // Resumen rápido
  const activos   = vendedores.filter(v => v.activo)
  const conComision = activos.filter(v => {
    const ult = v.ventas[v.ventas.length - 1]?.monto ?? 0
    return calcComision(ult, cfg).escala > 0
  })
  const totalComisiones = activos.reduce((sum, v) => {
    const ult = v.ventas[v.ventas.length - 1]?.monto ?? 0
    return sum + calcComision(ult, cfg).comision
  }, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comisiones</h1>
        <p className="text-gray-400 text-sm mt-0.5">Sistema quincenal escalonado — Sur Maderas</p>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Vendedores activos', value: activos.length, color: NAVY },
          { label: 'Con comisión',       value: conComision.length, color: CORAL },
          { label: 'Total a liquidar',   value: fmt(totalComisiones), color: '#16a34a', small: true },
        ].map(({ label, value, color, small }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className={`font-bold ${small ? 'text-sm' : 'text-2xl'}`} style={{ color }}>{value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all"
            style={tab === t.id
              ? { background: NAVY, color: 'white' }
              : { color: '#9ca3af' }}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Panel activo */}
      {tab === 'calculadora' && <TabCalculadora vendedores={vendedores} cfg={cfg} />}
      {tab === 'vendedores'  && <TabVendedores  vendedores={vendedores} setVendedores={setVendedores} cfg={cfg} />}
      {tab === 'reuniones'   && <TabReuniones   vendedores={vendedores} reuniones={reuniones} setReuniones={setReuniones} cfg={cfg} />}
      {tab === 'config'      && <TabConfig      cfg={cfg} setCfg={setCfg} />}
    </div>
  )
}
