import { useState } from 'react'
import {
  Calculator, Users, ClipboardList, Settings2,
  TableProperties, ChevronDown, ChevronUp, Plus, Check, X, Trash2,
  Briefcase, History, Save, RotateCcw, Calendar, Clock,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAVY  = '#070614'
const CORAL = '#C8603A'

// ── Types ─────────────────────────────────────────────────────────
type Turno = '6hs' | '7hs' | '8hs'

type Vendedor = {
  id: number
  nombre: string
  sucursal: 'luro' | 'independencia'
  turno: Turno
  activo: boolean
}

type RegistroQ = {
  id: number
  vendedorId: number
  quincena: string   // "Mayo 2026 - 1ra"
  ventas: number
  comision: number
  pct: number
  escala: number
  pagada: boolean
}

type EstadoReunion = 'pendiente' | 'realizada' | 'reprogramada'
type ReunionItem = { id: string; texto: string; hecho: boolean; nota: string }
type Reunion = {
  id: number
  vendedorId: number
  quincena: string
  fecha: string        // YYYY-MM-DD
  hora: string         // HH:MM
  estado: EstadoReunion
  items: ReunionItem[] // checklist con nota por ítem
  notas: string        // notas generales
  // legacy (compat con datos viejos)
  checks?: boolean[]
  realizada?: boolean
}

const ESTADO_REUNION: Record<EstadoReunion, { label: string; bg: string; color: string }> = {
  pendiente:    { label: 'Pendiente',    bg: '#fef9c3', color: '#854d0e' },
  realizada:    { label: 'Realizada',    bg: '#dcfce7', color: '#16a34a' },
  reprogramada: { label: 'Reprogramada', bg: '#e0e7ff', color: '#4338ca' },
}

let _ridSeq = 0
const newRid = () => `r${Date.now()}_${_ridSeq++}`

// Normaliza una reunión (soporta el formato viejo con checks/realizada)
function normReunion(r: Reunion, template: string[]): Reunion {
  if (r.items && Array.isArray(r.items)) {
    return { ...r, estado: r.estado ?? 'pendiente', fecha: r.fecha ?? '', hora: r.hora ?? '', notas: r.notas ?? '' }
  }
  const items: ReunionItem[] = template.map((texto, i) => ({
    id: newRid(), texto, hecho: r.checks?.[i] ?? false, nota: '',
  }))
  return {
    ...r, items, notas: r.notas ?? '',
    estado: r.realizada ? 'realizada' : 'pendiente',
    fecha: r.fecha ?? '', hora: r.hora ?? '',
  }
}

// Planilla de descripcion de puesto
type Puesto = {
  id:                string
  nombre:            string
  responsabilidades: string
  criterios:         string
  evaluacion:        string
}

const PUESTOS_DEFAULT: Puesto[] = [
  { id: 'vend1',    nombre: 'Ariel Viejo',   responsabilidades: '', criterios: '', evaluacion: '' },
  { id: 'vend2',    nombre: 'Pato Scatizzi', responsabilidades: '', criterios: '', evaluacion: '' },
  { id: 'vend3',    nombre: 'Valentina',      responsabilidades: '', criterios: '', evaluacion: '' },
  { id: 'caja',     nombre: 'Cecilia Vila',   responsabilidades: '', criterios: '', evaluacion: '' },
  { id: 'taller1',  nombre: 'Facundo Lalli',  responsabilidades: '', criterios: '', evaluacion: '' },
  { id: 'taller2',  nombre: 'Marcelo Viejo',  responsabilidades: '', criterios: '', evaluacion: '' },
]

type Config = {
  // 6hs
  s6_e1_desde: number; s6_e1_pct: number
  s6_e2_desde: number; s6_e2_pct: number
  s6_e3_desde: number; s6_e3_pct: number
  // 7hs
  s7_e1_desde: number; s7_e1_pct: number
  s7_e2_desde: number; s7_e2_pct: number
  s7_e3_desde: number; s7_e3_pct: number
  // 8hs
  s8_e1_desde: number; s8_e1_pct: number
  s8_e2_desde: number; s8_e2_pct: number
  s8_e3_desde: number; s8_e3_pct: number
}

const CHECKLIST_ITEMS = [
  'Revision de ventas de la quincena',
  'Logros destacados del periodo',
  'Puntos a mejorar',
  'Objetivos para la proxima quincena',
  'Consultas del vendedor',
]

const DEFAULT_CONFIG: Config = {
  s6_e1_desde: 3_400_000, s6_e1_pct: 0.5,
  s6_e2_desde: 3_950_000, s6_e2_pct: 1.0,
  s6_e3_desde: 4_750_000, s6_e3_pct: 1.5,
  s7_e1_desde: 3_900_000, s7_e1_pct: 0.5,
  s7_e2_desde: 4_550_000, s7_e2_pct: 1.0,
  s7_e3_desde: 5_450_000, s7_e3_pct: 1.5,
  s8_e1_desde: 4_300_000, s8_e1_pct: 0.5,
  s8_e2_desde: 5_000_000, s8_e2_pct: 1.0,
  s8_e3_desde: 6_000_000, s8_e3_pct: 1.5,
}

const DEFAULT_VENDEDORES: Vendedor[] = [
  { id: 1, nombre: 'Cecilia Vila',    sucursal: 'luro', turno: '6hs', activo: true },
  { id: 2, nombre: 'Ariel Viejo',     sucursal: 'luro', turno: '8hs', activo: true },
  { id: 3, nombre: 'Pato Scatizzi',   sucursal: 'luro', turno: '6hs', activo: true },
  { id: 4, nombre: 'Valentina',       sucursal: 'luro', turno: '6hs', activo: true },
  { id: 5, nombre: 'Facundo Lalli',   sucursal: 'luro', turno: '8hs', activo: true },
  { id: 6, nombre: 'Marcelo Viejo',   sucursal: 'luro', turno: '8hs', activo: true },
]

// ── Helpers ───────────────────────────────────────────────────────
const fmt  = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtM = (n: number) => '$' + (n / 1_000_000).toFixed(1) + 'M'

// Color distintivo por turno
function turnoColor(t: Turno): string {
  return t === '6hs' ? CORAL : t === '7hs' ? '#2D5A8E' : '#2D7A3A'
}
function turnoLabel(t: Turno): string {
  return t === '8hs' ? '8-9hs' : t
}

function getEscalas(turno: Turno, cfg: Config) {
  if (turno === '6hs') return [
    { desde: cfg.s6_e1_desde, pct: cfg.s6_e1_pct },
    { desde: cfg.s6_e2_desde, pct: cfg.s6_e2_pct },
    { desde: cfg.s6_e3_desde, pct: cfg.s6_e3_pct },
  ]
  if (turno === '7hs') return [
    { desde: cfg.s7_e1_desde, pct: cfg.s7_e1_pct },
    { desde: cfg.s7_e2_desde, pct: cfg.s7_e2_pct },
    { desde: cfg.s7_e3_desde, pct: cfg.s7_e3_pct },
  ]
  return [
    { desde: cfg.s8_e1_desde, pct: cfg.s8_e1_pct },
    { desde: cfg.s8_e2_desde, pct: cfg.s8_e2_pct },
    { desde: cfg.s8_e3_desde, pct: cfg.s8_e3_pct },
  ]
}

function calcComision(ventas: number, turno: Turno, cfg: Config) {
  const [e1, e2, e3] = getEscalas(turno, cfg)
  if (ventas >= e3.desde) return { comision: ventas * e3.pct / 100, pct: e3.pct, escala: 3 }
  if (ventas >= e2.desde) return { comision: ventas * e2.pct / 100, pct: e2.pct, escala: 2 }
  if (ventas >= e1.desde) return { comision: ventas * e1.pct / 100, pct: e1.pct, escala: 1 }
  return { comision: 0, pct: 0, escala: 0 }
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function quincenaLabel() {
  const now = new Date()
  const q   = now.getDate() <= 15 ? '1ra' : '2da'
  return `${MESES[now.getMonth()]} ${now.getFullYear()} - ${q}`
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

// ── Tab nav ───────────────────────────────────────────────────────
type Tab = 'calculadora' | 'registro' | 'vendedores' | 'reuniones' | 'puestos' | 'config'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'calculadora', label: 'Calculadora', icon: <Calculator size={13}/> },
  { id: 'registro',    label: 'Registro',    icon: <TableProperties size={13}/> },
  { id: 'vendedores',  label: 'Vendedores',  icon: <Users size={13}/> },
  { id: 'reuniones',   label: 'Reuniones',   icon: <ClipboardList size={13}/> },
  { id: 'puestos',     label: 'Puestos',     icon: <Briefcase size={13}/> },
  { id: 'config',      label: 'Config',      icon: <Settings2 size={13}/> },
]

// ═══════════════════════════════════════════════════════════════════
// CALCULADORA
// ═══════════════════════════════════════════════════════════════════
function TabCalculadora({ vendedores, cfg }: { vendedores: Vendedor[]; cfg: Config }) {
  const [vendId, setVendId] = useState(vendedores[0]?.id ?? 0)
  const [input,  setInput]  = useState('')

  const vend  = vendedores.find(v => v.id === vendId) ?? vendedores[0]
  const turno = vend?.turno ?? '6hs'
  const ventas = parseFloat(input.replace(/\./g, '').replace(',', '.')) || 0
  const { comision, pct, escala } = calcComision(ventas, turno, cfg)
  const [e1, e2, e3] = getEscalas(turno, cfg)

  const max  = e3.desde * 1.4
  const barBase = Math.min(e1.desde, ventas) / max * 100
  const barE1   = Math.max(0, Math.min(e2.desde - e1.desde, ventas - e1.desde)) / max * 100
  const barE2   = Math.max(0, Math.min(e3.desde - e2.desde, ventas - e2.desde)) / max * 100
  const barE3   = Math.max(0, ventas - e3.desde) / max * 100
  const barRest = Math.max(0, 100 - barBase - barE1 - barE2 - barE3)

  const falta =
    escala === 0 ? null
    : escala === 1 ? fmt(e2.desde - ventas) + ' para Escala 2'
    : escala === 2 ? fmt(e3.desde - ventas) + ' para Escala 3'
    : '¡Maxima escala!'

  // Próximo escalón (para mensaje motivador): desde y % objetivo
  const prox =
    escala === 0 ? { desde: e1.desde, pct: e1.pct } :
    escala === 1 ? { desde: e2.desde, pct: e2.pct } :
    escala === 2 ? { desde: e3.desde, pct: e3.pct } : null
  const faltante = prox ? prox.desde - ventas : 0
  // Cerca: dentro del 15% de diferencia respecto al próximo escalón
  const cerca = !!prox && ventas > 0 && faltante > 0 && faltante <= prox.desde * 0.15
  const col = turnoColor(turno)

  return (
    <div className="space-y-4">
      {/* Selector vendedor */}
      <div>
        <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-2">Vendedor</p>
        <div className="flex flex-wrap gap-2">
          {vendedores.filter(v => v.activo).map(v => (
            <button key={v.id} onClick={() => { setVendId(v.id); setInput('') }}
              className="px-3 py-1.5 rounded-full text-sm font-bold transition-all border-2"
              style={vendId === v.id
                ? { background: NAVY, color: 'white', borderColor: NAVY }
                : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}>
              {v.nombre}
              <span className="ml-1.5 text-[10px] opacity-60">{v.turno}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Turno badge */}
      {vend && (
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full font-bold"
            style={{ background: col + '18', color: col }}>
            Turno {turnoLabel(turno)}
          </span>
          <span className="text-xs text-gray-400">
            Piso: {fmtM(e1.desde)}
          </span>
        </div>
      )}

      {/* Input */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-3">
          Ventas cobradas en la quincena
        </p>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: CORAL }}>$</span>
          <input type="text" inputMode="numeric" value={input}
            onChange={e => setInput(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            className="flex-1 text-3xl font-bold text-gray-800 outline-none bg-transparent" />
        </div>

        {/* Barra */}
        <div className="mt-4 h-2.5 rounded-full overflow-hidden flex bg-gray-100">
          {barBase > 0 && <div style={{ flex: barBase, background: '#d1d5db' }} />}
          {barE1   > 0 && <div style={{ flex: barE1,   background: '#f59e0b' }} />}
          {barE2   > 0 && <div style={{ flex: barE2,   background: CORAL }} />}
          {barE3   > 0 && <div style={{ flex: barE3,   background: NAVY }} />}
          {barRest > 0 && <div style={{ flex: barRest, background: '#f3f4f6' }} />}
        </div>

        <div className="flex gap-3 mt-2 flex-wrap">
          {[
            { color: '#d1d5db', label: `Piso ${fmtM(e1.desde)}` },
            { color: '#f59e0b', label: `E1 ${e1.pct}%` },
            { color: CORAL,    label: `E2 ${e2.pct}%` },
            { color: NAVY,     label: `E3 ${e3.pct}%` },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mensaje motivador: cerca del próximo escalón */}
      {cerca && prox && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: col + '12', border: `1px solid ${col}33` }}>
          <span className="text-2xl">🔥</span>
          <p className="text-sm font-semibold" style={{ color: col }}>
            ¡Estás cerca! Te faltan <strong>{fmt(faltante)}</strong> para llegar a la escala de <strong>{prox.pct}%</strong>.
          </p>
        </div>
      )}

      {ventas > 0 && escala === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-red-600">No alcanza el piso minimo</p>
          <p className="text-sm text-red-500 mt-1">
            Faltan <strong>{fmt(e1.desde - ventas)}</strong> para comision (piso: {fmtM(e1.desde)})
          </p>
        </div>
      )}

      {ventas > 0 && escala > 0 && (
        <>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
            style={escala === 3 ? { background: NAVY + '15', color: NAVY }
                 : escala === 2 ? { background: CORAL + '18', color: CORAL }
                 : { background: '#fef3c7', color: '#92400e' }}>
            Escala {escala} — {pct}%{escala === 3 ? ' 🏆' : ''}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">Comision</p>
              <p className="text-2xl font-bold" style={{ color: CORAL }}>{fmt(comision)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">% aplicado</p>
              <p className="text-2xl font-bold" style={{ color: NAVY }}>{pct}%</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">Ventas</p>
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
// REGISTRO QUINCENAL
// ═══════════════════════════════════════════════════════════════════
function TabRegistro({
  vendedores, registros, setRegistros, cfg,
}: {
  vendedores: Vendedor[]
  registros: RegistroQ[]
  setRegistros: (r: RegistroQ[]) => void
  cfg: Config
}) {
  const [vendId,     setVendId]     = useState(vendedores[0]?.id ?? 0)
  const [quincena,   setQuincena]   = useState(quincenaLabel())
  const [ventaInput, setVentaInput] = useState('')
  const [adding,     setAdding]     = useState(false)
  const [filtroVend, setFiltroVend] = useState<number | 'todos'>('todos')

  const vend = vendedores.find(v => v.id === vendId)

  function registrar() {
    if (!vend) return
    const ventas = parseFloat(ventaInput.replace(/\./g, '').replace(',', '.')) || 0
    if (!ventas) return
    const { comision, pct, escala } = calcComision(ventas, vend.turno, cfg)
    const nuevo: RegistroQ = {
      id: Date.now(), vendedorId: vendId, quincena,
      ventas, comision, pct, escala, pagada: false,
    }
    setRegistros([nuevo, ...registros])
    setVentaInput(''); setAdding(false)
  }

  function togglePagada(id: number) {
    setRegistros(registros.map(r => r.id === id ? { ...r, pagada: !r.pagada } : r))
  }

  function eliminar(id: number) {
    if (!confirm('Eliminar este registro?')) return
    setRegistros(registros.filter(r => r.id !== id))
  }

  const filtrados = filtroVend === 'todos'
    ? registros
    : registros.filter(r => r.vendedorId === filtroVend)

  const totalPendiente = filtrados
    .filter(r => !r.pagada)
    .reduce((s, r) => s + r.comision, 0)

  return (
    <div className="space-y-4">

      {/* Barra superior */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroVend('todos')}
            className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
            style={filtroVend === 'todos'
              ? { background: NAVY, color: 'white', borderColor: NAVY }
              : { borderColor: '#e5e7eb', color: '#6b7280' }}>
            Todos
          </button>
          {vendedores.filter(v => v.activo).map(v => (
            <button key={v.id}
              onClick={() => setFiltroVend(v.id)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
              style={filtroVend === v.id
                ? { background: NAVY, color: 'white', borderColor: NAVY }
                : { borderColor: '#e5e7eb', color: '#6b7280' }}>
              {v.nombre}
            </button>
          ))}
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
          style={{ background: CORAL }}>
          <Plus size={13}/> Registrar
        </button>
      </div>

      {/* KPI pendiente */}
      {totalPendiente > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">Total pendiente de pago</p>
          <p className="text-xl font-bold" style={{ color: CORAL }}>{fmt(totalPendiente)}</p>
        </div>
      )}

      {/* Formulario */}
      {adding && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="font-bold text-gray-700 text-sm">Nueva quincena</p>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Vendedor</p>
            <div className="flex flex-wrap gap-2">
              {vendedores.filter(v => v.activo).map(v => (
                <button key={v.id} onClick={() => setVendId(v.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
                  style={vendId === v.id
                    ? { background: NAVY, color: 'white', borderColor: NAVY }
                    : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {v.nombre} <span className="opacity-60">({v.turno})</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Quincena</p>
            <input type="text" value={quincena}
              onChange={e => setQuincena(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400" />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Ventas cobradas</p>
            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2">
              <span className="font-bold" style={{ color: CORAL }}>$</span>
              <input type="text" inputMode="numeric" value={ventaInput}
                onChange={e => setVentaInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0"
                className="flex-1 text-sm outline-none bg-transparent font-bold" />
            </div>
            {/* Preview comision */}
            {ventaInput && vend && (() => {
              const v = parseFloat(ventaInput.replace(/\./g,'').replace(',','.')) || 0
              const { comision, pct, escala } = calcComision(v, vend.turno, cfg)
              return escala > 0 ? (
                <p className="text-xs mt-1.5 font-semibold" style={{ color: CORAL }}>
                  Comision: {fmt(comision)} · Escala {escala} ({pct}%)
                </p>
              ) : (
                <p className="text-xs mt-1.5 text-gray-400">
                  No alcanza el piso ({fmtM(getEscalas(vend.turno, cfg)[0].desde)})
                </p>
              )
            })()}
          </div>

          <div className="flex gap-2">
            <button onClick={registrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: CORAL }}>
              Guardar registro
            </button>
            <button onClick={() => { setAdding(false); setVentaInput('') }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="text-center py-10 text-gray-300">
          <TableProperties size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin registros todavia</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Header tabla */}
          <div className="grid gap-2 px-4 py-2 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400"
            style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 60px 32px' }}>
            <span>Vendedor</span>
            <span>Quincena</span>
            <span>Ventas</span>
            <span className="text-right">Comision</span>
            <span className="text-center">Pagada</span>
            <span></span>
          </div>

          {filtrados.map(r => {
            const v = vendedores.find(v => v.id === r.vendedorId)
            return (
              <div key={r.id}
                className="grid gap-2 px-4 py-3 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50 transition-colors"
                style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 60px 32px' }}>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{v?.nombre ?? '-'}</p>
                  <p className="text-[10px] text-gray-400">{v?.turno}</p>
                </div>
                <p className="text-xs text-gray-500">{r.quincena}</p>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{fmt(r.ventas)}</p>
                  <p className="text-[10px]" style={{ color: CORAL }}>Esc.{r.escala} · {r.pct}%</p>
                </div>
                <p className="text-sm font-bold text-right" style={{ color: r.comision > 0 ? CORAL : '#9ca3af' }}>
                  {fmt(r.comision)}
                </p>
                <div className="flex justify-center">
                  <button onClick={() => togglePagada(r.id)}
                    className="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all"
                    style={r.pagada
                      ? { background: '#16a34a', borderColor: '#16a34a' }
                      : { borderColor: '#d1d5db' }}>
                    {r.pagada && <Check size={11} color="white" strokeWidth={3}/>}
                  </button>
                </div>
                <button onClick={() => eliminar(r.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors flex justify-center">
                  <Trash2 size={14}/>
                </button>
              </div>
            )
          })}

          {/* Total */}
          {filtrados.length > 1 && (
            <div className="grid gap-2 px-4 py-3 border-t-2 border-gray-100 items-center"
              style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 60px 32px', background: '#f8f7f5' }}>
              <p className="text-xs font-bold text-gray-500 col-span-3">
                Total ({filtrados.length} registros)
              </p>
              <p className="text-sm font-bold text-right" style={{ color: NAVY }}>
                {fmt(filtrados.reduce((s, r) => s + r.comision, 0))}
              </p>
              <p className="text-[10px] text-center text-gray-400">
                {filtrados.filter(r => r.pagada).length}/{filtrados.length} pag.
              </p>
              <span/>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// VENDEDORES
// ═══════════════════════════════════════════════════════════════════
function TabVendedores({
  vendedores, setVendedores,
}: {
  vendedores: Vendedor[]
  setVendedores: (v: Vendedor[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [nombre, setNombre] = useState('')
  const [suc,    setSuc]    = useState<'luro'|'independencia'>('luro')
  const [turno,  setTurno]  = useState<Turno>('6hs')

  function add() {
    if (!nombre.trim()) return
    setVendedores([...vendedores, {
      id: Date.now(), nombre: nombre.trim(), sucursal: suc, turno, activo: true,
    }])
    setNombre(''); setAdding(false)
  }

  function toggle(id: number) {
    setVendedores(vendedores.map(v => v.id === id ? { ...v, activo: !v.activo } : v))
  }
  function setVendTurno(id: number, t: Turno) {
    setVendedores(vendedores.map(v => v.id === id ? { ...v, turno: t } : v))
  }

  return (
    <div className="space-y-3">
      {vendedores.map(v => (
        <div key={v.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: v.activo ? turnoColor(v.turno) : '#d1d5db' }}>
            {v.nombre.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800">{v.nombre}</p>
            <div className="flex gap-2 mt-1 flex-wrap items-center">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: CORAL + '18', color: CORAL }}>
                {v.sucursal === 'luro' ? 'Luro' : 'Independencia'}
              </span>
              {/* Turno editable */}
              <div className="flex gap-1">
                {(['6hs', '7hs', '8hs'] as Turno[]).map(t => (
                  <button key={t} onClick={() => setVendTurno(v.id, t)}
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold transition-all border"
                    style={v.turno === t
                      ? { background: turnoColor(t), color: 'white', borderColor: turnoColor(t) }
                      : { background: 'white', color: '#9ca3af', borderColor: '#e5e7eb' }}>
                    {turnoLabel(t)}
                  </button>
                ))}
              </div>
              {!v.activo && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-semibold">
                  Inactivo
                </span>
              )}
            </div>
          </div>
          <button onClick={() => toggle(v.id)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
            style={v.activo
              ? { borderColor: '#e5e7eb', color: '#9ca3af' }
              : { borderColor: CORAL, color: CORAL }}>
            {v.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      ))}

      {adding ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="font-bold text-gray-700 text-sm">Nuevo vendedor</p>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
            autoFocus />
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Sucursal</p>
            <div className="flex gap-2">
              {(['luro', 'independencia'] as const).map(s => (
                <button key={s} onClick={() => setSuc(s)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={suc === s ? { background: NAVY, color: 'white', borderColor: NAVY } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {s === 'luro' ? 'Luro' : 'Independencia'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Turno</p>
            <div className="flex gap-2">
              {(['6hs', '7hs', '8hs'] as Turno[]).map(t => (
                <button key={t} onClick={() => setTurno(t)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={turno === t ? { background: CORAL, color: 'white', borderColor: CORAL } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={add}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: CORAL }}>
              <Check size={13} className="inline mr-1"/> Agregar
            </button>
            <button onClick={() => { setAdding(false); setNombre('') }}
              className="px-4 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-500">
              <X size={13} className="inline mr-1"/> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-3 rounded-2xl text-sm font-bold border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all flex items-center justify-center gap-2">
          <Plus size={14}/> Agregar vendedor
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// REUNIONES (quincena actual + historial + plantilla)
// ═══════════════════════════════════════════════════════════════════
function TabReuniones({
  vendedores, reuniones, setReuniones, registros, template, setTemplate,
}: {
  vendedores: Vendedor[]
  reuniones: Reunion[]
  setReuniones: (r: Reunion[]) => void
  registros: RegistroQ[]
  template: string[]
  setTemplate: (t: string[]) => void
}) {
  const qActual = quincenaLabel()
  const [vista, setVista] = useState<'actual' | 'historial' | 'plantilla'>('actual')
  const [filtroVend, setFiltroVend] = useState<number | 'todos'>('todos')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const hoyISO = new Date().toISOString().slice(0, 10)

  function getReunion(vendId: number): Reunion {
    const ex = reuniones.find(r => r.vendedorId === vendId && r.quincena === qActual)
    if (ex) return normReunion(ex, template)
    return {
      id: Date.now() + vendId, vendedorId: vendId, quincena: qActual,
      fecha: hoyISO, hora: '', estado: 'pendiente',
      items: template.map(texto => ({ id: newRid(), texto, hecho: false, nota: '' })),
      notas: '',
    }
  }

  function save(updated: Reunion) {
    const exists = reuniones.some(r => r.vendedorId === updated.vendedorId && r.quincena === updated.quincena)
    setReuniones(exists
      ? reuniones.map(r => (r.vendedorId === updated.vendedorId && r.quincena === updated.quincena) ? updated : r)
      : [...reuniones, updated])
  }

  const historial = reuniones
    .map(r => normReunion(r, template))
    .filter(r => r.quincena !== qActual)
    .filter(r => filtroVend === 'todos' || r.vendedorId === filtroVend)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id))
  const quincenasUnicas = [...new Set(historial.map(r => r.quincena))]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['actual', 'Quincena actual', <ClipboardList size={12}/>], ['historial', 'Historial', <History size={12}/>], ['plantilla', 'Plantilla', <Settings2 size={12}/>]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setVista(id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={vista === id ? { background: NAVY, color: 'white' } : { color: '#6b7280' }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {vista === 'actual' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-3">
            <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400">Quincena actual</p>
            <p className="font-bold text-gray-700 mt-0.5">{qActual}</p>
          </div>
          {vendedores.filter(v => v.activo).map(v => {
            const reg = registros.find(r => r.vendedorId === v.id && r.quincena === qActual)
            return <ReunionCard key={v.id} vend={v} reunion={getReunion(v.id)} reg={reg} onSave={save} />
          })}
        </>
      )}

      {vista === 'historial' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFiltroVend('todos')}
              className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
              style={filtroVend === 'todos' ? { background: NAVY, color: 'white', borderColor: NAVY } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
              Todos
            </button>
            {vendedores.filter(v => v.activo).map(v => (
              <button key={v.id} onClick={() => setFiltroVend(v.id)}
                className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
                style={filtroVend === v.id ? { background: NAVY, color: 'white', borderColor: NAVY } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                {v.nombre}
              </button>
            ))}
          </div>
          {historial.length === 0 ? (
            <div className="text-center py-12 text-gray-300">
              <History size={32} className="mx-auto mb-2 opacity-40"/>
              <p className="text-sm">Sin historial de reuniones todavía</p>
            </div>
          ) : quincenasUnicas.map(q => (
            <div key={q}>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-gray-200"/>
                <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400 px-2">{q}</span>
                <div className="h-px flex-1 bg-gray-200"/>
              </div>
              <div className="space-y-2">
                {historial.filter(r => r.quincena === q).map(r => {
                  const v = vendedores.find(v => v.id === r.vendedorId)
                  const done = r.items.filter(i => i.hecho).length
                  const isOpen = expandedId === r.id
                  const est = ESTADO_REUNION[r.estado]
                  return (
                    <div key={r.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <button onClick={() => setExpandedId(isOpen ? null : r.id)}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: est.color }}>{v?.nombre.charAt(0) ?? '?'}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-800">{v?.nombre ?? '-'}</p>
                          <p className="text-[10px] text-gray-400">{r.fecha ? fmtFechaCorta(r.fecha) : 's/fecha'}{r.hora ? ` ${r.hora}` : ''} · {done}/{r.items.length} ítems</p>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: est.bg, color: est.color }}>{est.label}</span>
                        {isOpen ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 pt-1 space-y-2 border-t border-gray-50">
                          {r.items.map(it => (
                            <div key={it.id} className="py-1">
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={it.hecho ? { background: CORAL } : { background: '#f3f4f6' }}>
                                  {it.hecho && <Check size={9} color="white" strokeWidth={3}/>}
                                </div>
                                <span className={`text-xs font-semibold ${it.hecho ? 'text-gray-400' : 'text-gray-700'}`}>{it.texto}</span>
                              </div>
                              {it.nota && <p className="text-xs text-gray-500 ml-6 mt-0.5 leading-relaxed">{it.nota}</p>}
                            </div>
                          ))}
                          {r.notas && (
                            <div className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Notas generales</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{r.notas}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {vista === 'plantilla' && <PlantillaEditor template={template} setTemplate={setTemplate} />}
    </div>
  )
}

function fmtFechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function ReunionCard({ vend, reunion, reg, onSave }: {
  vend: Vendedor; reunion: Reunion; reg?: RegistroQ; onSave: (r: Reunion) => void
}) {
  const est = ESTADO_REUNION[reunion.estado]
  const done = reunion.items.filter(i => i.hecho).length
  const set = (patch: Partial<Reunion>) => onSave({ ...reunion, ...patch })
  const toggleItem  = (id: string) => set({ items: reunion.items.map(i => i.id === id ? { ...i, hecho: !i.hecho } : i) })
  const setItemNota = (id: string, nota: string) => set({ items: reunion.items.map(i => i.id === id ? { ...i, nota } : i) })
  const setItemTexto= (id: string, texto: string) => set({ items: reunion.items.map(i => i.id === id ? { ...i, texto } : i) })
  const delItem     = (id: string) => set({ items: reunion.items.filter(i => i.id !== id) })
  const addItem     = () => set({ items: [...reunion.items, { id: newRid(), texto: 'Ítem personalizado', hecho: false, nota: '' }] })
  const inp = "border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-gray-400"

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-100"
        style={{ background: reunion.estado === 'realizada' ? '#f0fdf4' : 'white' }}>
        <div className="min-w-0">
          <p className="font-bold text-gray-800">{vend.nombre} <span className="text-[10px] font-semibold" style={{ color: turnoColor(vend.turno) }}>({turnoLabel(vend.turno)})</span></p>
          <p className="text-xs text-gray-400 mt-0.5">
            {reg ? <>Comisión: <span className="font-bold" style={{ color: CORAL }}>{fmt(reg.comision)}</span> · {reg.pct}% · {fmt(reg.ventas)} en ventas</> : 'Sin ventas registradas esta quincena'}
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full shrink-0" style={{ background: est.bg, color: est.color }}>{est.label}</span>
      </div>

      <div className="px-5 pb-4 pt-3 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Calendar size={10}/> Fecha</label>
            <input type="date" className={`${inp} w-full`} value={reunion.fecha} onChange={e => set({ fecha: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Clock size={10}/> Hora</label>
            <input type="time" className={`${inp} w-full`} value={reunion.hora} onChange={e => set({ hora: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">Estado</label>
            <select className={`${inp} w-full`} value={reunion.estado} onChange={e => set({ estado: e.target.value as EstadoReunion })}>
              <option value="pendiente">Pendiente</option>
              <option value="realizada">Realizada</option>
              <option value="reprogramada">Reprogramada</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {reunion.items.map(it => (
            <div key={it.id} className="rounded-xl border border-gray-100 p-2.5">
              <div className="flex items-center gap-2">
                <button onClick={() => toggleItem(it.id)}
                  className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
                  style={it.hecho ? { background: CORAL, borderColor: CORAL } : { borderColor: '#e5e7eb' }}>
                  {it.hecho && <Check size={11} color="white" strokeWidth={3}/>}
                </button>
                <input value={it.texto} onChange={e => setItemTexto(it.id, e.target.value)}
                  className={`flex-1 text-sm font-semibold bg-transparent outline-none ${it.hecho ? 'text-gray-400 line-through' : 'text-gray-700'}`} />
                <button onClick={() => delItem(it.id)} className="text-red-300 hover:text-red-500 shrink-0"><Trash2 size={13}/></button>
              </div>
              <textarea value={it.nota} onChange={e => setItemNota(it.id, e.target.value)}
                placeholder="¿Qué se habló de este punto?" rows={1}
                className="w-full mt-1.5 text-xs border-b border-gray-100 focus:border-gray-300 outline-none resize-none placeholder:text-gray-300 pl-7" />
            </div>
          ))}
          <button onClick={addItem} className="text-xs font-semibold flex items-center gap-1" style={{ color: CORAL }}>
            <Plus size={13}/> Agregar ítem personalizado
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${reunion.items.length ? done / reunion.items.length * 100 : 0}%`, background: CORAL }}/>
          </div>
          <span className="text-xs text-gray-400">{done}/{reunion.items.length}</span>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase">Notas de la reunión (general)</label>
          <textarea value={reunion.notas} onChange={e => set({ notas: e.target.value })}
            placeholder="Notas adicionales…" rows={2}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none resize-none focus:border-gray-400 placeholder:text-gray-300" />
        </div>

        <button onClick={() => set({ estado: reunion.estado === 'realizada' ? 'pendiente' : 'realizada' })}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
          style={reunion.estado === 'realizada' ? { background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb' } : { background: NAVY, color: 'white' }}>
          {reunion.estado === 'realizada' ? 'Reabrir reunión' : 'Marcar como realizada'}
        </button>
      </div>
    </div>
  )
}

function PlantillaEditor({ template, setTemplate }: { template: string[]; setTemplate: (t: string[]) => void }) {
  const [items, setItems] = useState<string[]>(template)
  const [saved, setSaved] = useState(false)
  const set = (i: number, v: string) => setItems(items.map((x, idx) => idx === i ? v : x))
  const del = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const add = () => setItems([...items, ''])
  const guardar = () => { setTemplate(items.filter(x => x.trim())); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div>
        <p className="font-bold text-gray-800 text-sm">Plantilla de reunión</p>
        <p className="text-xs text-gray-400 mt-0.5">Estos ítems aparecen por defecto en cada reunión nueva. No afecta reuniones ya creadas.</p>
      </div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
            <input value={it} onChange={e => set(i, e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" />
            <button onClick={() => del(i)} className="text-red-300 hover:text-red-500 shrink-0"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-xs font-semibold flex items-center gap-1" style={{ color: CORAL }}>
        <Plus size={13}/> Agregar ítem a la plantilla
      </button>
      <button onClick={guardar}
        className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all"
        style={{ background: saved ? '#16a34a' : NAVY }}>
        {saved ? '✓ Plantilla guardada' : 'Guardar plantilla'}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// PLANILLA DE DESCRIPCIÓN DE PUESTO
// ═══════════════════════════════════════════════════════════════════
const PUESTO_COLORS: Record<string, { bg: string; text: string }> = {
  vend1:   { bg: NAVY,      text: '#fff' },
  vend2:   { bg: CORAL,     text: '#fff' },
  vend3:   { bg: '#7c3aed', text: '#fff' },
  caja:    { bg: '#16a34a', text: '#fff' },
  taller1: { bg: '#d97706', text: '#fff' },
  taller2: { bg: '#0891b2', text: '#fff' },
}

function TabPuestos({
  puestos, setPuestos,
}: {
  puestos: Puesto[]
  setPuestos: (p: Puesto[]) => void
}) {
  const [activoId, setActivoId] = useState<string>(puestos[0]?.id ?? 'vend1')
  const [saved,    setSaved]    = useState(false)

  const puesto = puestos.find(p => p.id === activoId) ?? puestos[0]

  function update(field: keyof Puesto, value: string) {
    setPuestos(puestos.map(p => p.id === activoId ? { ...p, [field]: value } : p))
  }

  function handleSave() {
    // ya persiste via useLocalState, solo feedback visual
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const sections: { key: keyof Puesto; label: string; placeholder: string; rows: number }[] = [
    {
      key:         'responsabilidades',
      label:       'Responsabilidades',
      placeholder: 'Describí las tareas y responsabilidades principales del puesto...\n\n• Atender clientes\n• Gestionar ventas\n• ...',
      rows:        6,
    },
    {
      key:         'criterios',
      label:       'Criterios de Desempeño',
      placeholder: 'Describí con qué criterios se mide el rendimiento...\n\n• Cumplimiento de metas de venta\n• Puntualidad y presencia\n• ...',
      rows:        5,
    },
    {
      key:         'evaluacion',
      label:       'Evaluación de Desempeño',
      placeholder: 'Historial de evaluaciones, observaciones o calificaciones...\n\nEj: Mayo 2026 — Buen desempeño, superó meta en 15%.',
      rows:        5,
    },
  ]

  const colores = PUESTO_COLORS[activoId] ?? { bg: NAVY, text: '#fff' }

  return (
    <div className="space-y-4">

      {/* Selector de puesto — chips */}
      <div className="flex flex-wrap gap-2">
        {puestos.map(p => {
          const c = PUESTO_COLORS[p.id] ?? { bg: NAVY, text: '#fff' }
          const isActive = activoId === p.id
          return (
            <button key={p.id} onClick={() => setActivoId(p.id)}
              className="px-4 py-2 rounded-full text-sm font-bold transition-all border-2"
              style={isActive
                ? { background: c.bg, color: c.text, borderColor: c.bg }
                : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}>
              {p.nombre}
            </button>
          )
        })}
      </div>

      {/* Encabezado del puesto */}
      <div className="rounded-2xl px-6 py-5 flex items-center justify-between"
        style={{ background: colores.bg }}>
        <div>
          <p className="text-xs font-bold tracking-[2px] uppercase opacity-70" style={{ color: colores.text }}>
            Planilla de Puesto
          </p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: colores.text }}>
            {puesto?.nombre}
          </p>
          <p className="text-xs mt-1 opacity-60" style={{ color: colores.text }}>
            Sur Maderas · Mar del Plata · {new Date().getFullYear()}
          </p>
        </div>
        <Briefcase size={36} style={{ color: colores.text, opacity: 0.3 }} />
      </div>

      {/* Campos editables */}
      <div className="space-y-4">
        {sections.map(({ key, label, placeholder, rows }) => (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Header sección */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2"
              style={{ background: colores.bg + '12' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: colores.bg }} />
              <p className="text-xs font-bold uppercase tracking-[1.5px]" style={{ color: colores.bg }}>
                {label}
              </p>
            </div>
            <div className="p-4">
              <textarea
                value={puesto?.[key] as string ?? ''}
                onChange={e => update(key, e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className="w-full text-sm text-gray-700 outline-none resize-none leading-relaxed placeholder:text-gray-300 bg-transparent"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Botón guardar */}
      <button onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-all"
        style={{ background: saved ? '#16a34a' : colores.bg }}>
        <Save size={14}/>
        {saved ? 'Guardado ✓' : 'Guardar planilla'}
      </button>

      {/* Info */}
      <p className="text-[10px] text-gray-400 text-center">
        Los datos se guardan automáticamente en este dispositivo.
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════
type CfgMeta = Record<string, { by: string; at: string }>

function TabConfig({ cfg, setCfg }: { cfg: Config; setCfg: (c: Config) => void }) {
  const { user } = useAuth()
  const [meta, setMeta] = useLocalState<CfgMeta>('com_cfg_meta', {})

  const TURNOS: { prefix: 's6' | 's7' | 's8'; turno: Turno; horas: string }[] = [
    { prefix: 's6', turno: '6hs', horas: '6 horas' },
    { prefix: 's7', turno: '7hs', horas: '7 horas' },
    { prefix: 's8', turno: '8hs', horas: '8 y 9 horas' },
  ]

  return (
    <div className="space-y-4">
      {TURNOS.map(t => (
        <TurnoCard key={t.prefix} {...t} cfg={cfg} setCfg={setCfg}
          meta={meta[t.prefix]} onMeta={m => setMeta({ ...meta, [t.prefix]: m })}
          userName={user?.username ?? 'Usuario'} />
      ))}
    </div>
  )
}

function TurnoCard({ prefix, turno, horas, cfg, setCfg, meta, onMeta, userName }: {
  prefix: 's6' | 's7' | 's8'; turno: Turno; horas: string
  cfg: Config; setCfg: (c: Config) => void
  meta?: { by: string; at: string }; onMeta: (m: { by: string; at: string }) => void
  userName: string
}) {
  const color = turnoColor(turno)
  const k = (s: string) => `${prefix}_${s}` as keyof Config
  // Estado local de los 4 valores editables de este turno
  const pick = (c: Config) => ({
    e1d: c[k('e1_desde')] as number, e1p: c[k('e1_pct')] as number,
    e2d: c[k('e2_desde')] as number, e2p: c[k('e2_pct')] as number,
    e3d: c[k('e3_desde')] as number, e3p: c[k('e3_pct')] as number,
  })
  const [open, setOpen]   = useState(false)
  const [v, setV]         = useState(pick(cfg))
  const [saved, setSaved] = useState(false)

  const errE2 = v.e2d <= v.e1d
  const errE3 = v.e3d <= v.e2d
  const hayError = errE2 || errE3
  const sucio = JSON.stringify(v) !== JSON.stringify(pick(cfg))

  const guardar = () => {
    if (hayError) return
    setCfg({ ...cfg,
      [k('e1_desde')]: v.e1d, [k('e1_pct')]: v.e1p,
      [k('e2_desde')]: v.e2d, [k('e2_pct')]: v.e2p,
      [k('e3_desde')]: v.e3d, [k('e3_pct')]: v.e3p,
    })
    onMeta({ by: userName, at: new Date().toISOString() })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  const restaurar = () => setV(pick(cfg))   // vuelve al último guardado

  const fmtMeta = meta ? `por ${meta.by} · ${new Date(meta.at).toLocaleDateString('es-AR')} ${new Date(meta.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'sin modificaciones'
  const num = "w-28 text-right text-sm font-bold border rounded-lg px-2 py-1 outline-none"

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header colapsable */}
      <button onClick={() => setOpen(o => !o)} className="w-full px-5 py-3 flex items-center justify-between" style={{ background: color }}>
        <div className="text-left">
          <p className="text-white font-bold text-sm">Turno {turnoLabel(turno)}</p>
          <p className="text-white/70 text-[11px]">Empleados de {horas}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/80 text-[11px]">Piso {fmtM(v.e1d)}</span>
          {open ? <ChevronUp size={16} color="white"/> : <ChevronDown size={16} color="white"/>}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Mini-tabla */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <span>Escalón</span><span className="text-right w-28">Desde $</span><span className="text-right w-16">%</span>
            </div>
            {/* Piso */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 items-center border-t border-gray-50">
              <span className="text-xs text-gray-500">Sin comisión hasta acá</span>
              <input type="number" className={`${num} border-gray-200`} value={v.e1d}
                onChange={e => setV({ ...v, e1d: parseFloat(e.target.value) || 0 })} />
              <input type="number" className="w-16 text-right text-sm font-bold border border-gray-200 rounded-lg px-2 py-1 outline-none" value={v.e1p}
                onChange={e => setV({ ...v, e1p: parseFloat(e.target.value) || 0 })} />
            </div>
            {/* Escala 2 */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 items-center border-t border-gray-50">
              <span className="text-xs font-semibold" style={{ color }}>Escala 2</span>
              <input type="number" className={`${num} ${errE2 ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} value={v.e2d}
                onChange={e => setV({ ...v, e2d: parseFloat(e.target.value) || 0 })} />
              <input type="number" className="w-16 text-right text-sm font-bold border border-gray-200 rounded-lg px-2 py-1 outline-none" value={v.e2p}
                onChange={e => setV({ ...v, e2p: parseFloat(e.target.value) || 0 })} />
            </div>
            {/* Escala 3 */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 items-center border-t border-gray-50">
              <span className="text-xs font-semibold" style={{ color }}>Escala 3</span>
              <input type="number" className={`${num} ${errE3 ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} value={v.e3d}
                onChange={e => setV({ ...v, e3d: parseFloat(e.target.value) || 0 })} />
              <input type="number" className="w-16 text-right text-sm font-bold border border-gray-200 rounded-lg px-2 py-1 outline-none" value={v.e3p}
                onChange={e => setV({ ...v, e3p: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          {/* Errores de validación */}
          {errE2 && <p className="text-xs text-red-500">Escala 2 debe ser mayor al piso mínimo.</p>}
          {errE3 && <p className="text-xs text-red-500">Escala 3 debe ser mayor a Escala 2.</p>}

          {/* Última modificación */}
          <p className="text-[11px] text-gray-400">Última modificación: {fmtMeta}</p>

          {/* Botones */}
          <div className="flex gap-2">
            <button onClick={guardar} disabled={hayError || !sucio}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ background: saved ? '#16a34a' : color }}>
              {saved ? '✓ Guardado' : 'Guardar'}
            </button>
            <button onClick={restaurar} disabled={!sucio}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 disabled:opacity-40 flex items-center gap-1">
              <RotateCcw size={13}/> Restaurar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════
export default function Comisiones() {
  const [activeTab, setActiveTab]       = useState<Tab>('calculadora')
  const [cfgRaw,      setCfg]           = useLocalState<Config>('com_cfg', DEFAULT_CONFIG)
  // Mezcla con defaults para que config vieja (sin 7hs) no rompa nada
  const cfg = { ...DEFAULT_CONFIG, ...cfgRaw }
  const [vendedores,  setVendedores]    = useLocalState<Vendedor[]>('com_vendedores_v2', DEFAULT_VENDEDORES)
  const [registros,   setRegistros]     = useLocalState<RegistroQ[]>('com_registros', [])
  const [reuniones,   setReuniones]     = useLocalState<Reunion[]>('com_reuniones', [])
  const [reuTemplate, setReuTemplate]   = useLocalState<string[]>('com_reuniones_template', CHECKLIST_ITEMS)
  const [puestos,     setPuestos]       = useLocalState<Puesto[]>('com_puestos_v2', PUESTOS_DEFAULT)

  const activos       = vendedores.filter(v => v.activo)
  const totalPendiente = registros.filter(r => !r.pagada).reduce((s, r) => s + r.comision, 0)
  const qActual       = quincenaLabel()
  const reunsPendientes = activos.filter(v =>
    !reuniones.find(r => r.vendedorId === v.id && r.quincena === qActual && r.realizada)
  ).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comisiones</h1>
        <p className="text-gray-400 text-sm mt-0.5">Sistema quincenal escalonado | Sur Maderas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: NAVY }}>{activos.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Vendedores activos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-sm font-bold" style={{ color: totalPendiente > 0 ? CORAL : '#9ca3af' }}>
            {fmt(totalPendiente)}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Pendiente de pago</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: reunsPendientes > 0 ? '#f59e0b' : '#16a34a' }}>
            {reunsPendientes}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Reuniones pendientes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold transition-all"
            style={activeTab === t.id ? { background: NAVY, color: 'white' } : { color: '#9ca3af' }}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'calculadora' && <TabCalculadora vendedores={vendedores} cfg={cfg} />}
      {activeTab === 'registro'    && <TabRegistro    vendedores={vendedores} registros={registros} setRegistros={setRegistros} cfg={cfg} />}
      {activeTab === 'vendedores'  && <TabVendedores  vendedores={vendedores} setVendedores={setVendedores} />}
      {activeTab === 'reuniones'   && <TabReuniones   vendedores={vendedores} reuniones={reuniones} setReuniones={setReuniones} registros={registros} template={reuTemplate} setTemplate={setReuTemplate} />}
      {activeTab === 'puestos'     && <TabPuestos     puestos={puestos} setPuestos={setPuestos} />}
      {activeTab === 'config'      && <TabConfig      cfg={cfg} setCfg={setCfg} />}
    </div>
  )
}
