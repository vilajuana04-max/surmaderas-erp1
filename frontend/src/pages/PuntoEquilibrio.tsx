import { useState, useEffect, useId } from 'react'
import { Trash2, Plus, TrendingUp, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'

// ── Colores ───────────────────────────────────────────────────────
const NAVY  = '#070614'
const CORAL = '#C8603A'

// ── Tipos ─────────────────────────────────────────────────────────
interface CostoFijo {
  id:          string
  categoria:   string
  descripcion: string
  monto:       number
}
interface Config {
  margen_bruto_pct: number   // ej: 35  →  35 %
}

// ── localStorage ──────────────────────────────────────────────────
const LS_COSTOS = 'pe_costos'
const LS_CONFIG = 'pe_config'
const LS_VENTAS = 'pe_ventas_mes'

const DEFAULT_CONFIG: Config = { margen_bruto_pct: 35 }

const DEFAULT_COSTOS: CostoFijo[] = [
  { id: '1', categoria: 'Personal',   descripcion: 'Sueldos y cargas sociales', monto: 0 },
  { id: '2', categoria: 'Alquiler',   descripcion: 'Alquiler local',            monto: 0 },
  { id: '3', categoria: 'Servicios',  descripcion: 'Luz, gas, internet',        monto: 0 },
]

const CATEGORIAS = ['Personal', 'Alquiler', 'Servicios', 'Impuestos', 'Comisiones', 'Otros']

// ── Helpers ───────────────────────────────────────────────────────
function fmt$(n: number) {
  return `$ ${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function parseMonto(v: string) {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
}
function uid() {
  return Math.random().toString(36).slice(2, 9)
}
function mesActual() {
  const now = new Date()
  return `${now.toLocaleString('es-AR', { month: 'long' })} ${now.getFullYear()}`
}

// ── Gauge / barra de progreso ─────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 150)
  const color =
    pct < 70  ? '#ef4444' :
    pct < 95  ? '#f59e0b' :
    pct < 110 ? '#22c55e' : '#C8603A'

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-semibold" style={{ color: NAVY }}>
        <span>0 %</span>
        <span style={{ color }}>
          {pct.toFixed(1)} % del PE alcanzado
        </span>
        <span>150 %</span>
      </div>
      {/* pista */}
      <div className="relative h-5 rounded-full overflow-hidden bg-gray-100">
        {/* marca de PE */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
          style={{ left: `${(100 / 150) * 100}%` }}
        />
        {/* barra de progreso */}
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${(clamped / 150) * 100}%`, background: color }}
        />
      </div>
      {/* leyenda */}
      <div className="flex justify-between text-[10px] text-gray-400 tracking-wide">
        <span>PÉRDIDA</span>
        <span style={{ marginLeft: `${(100 / 150) * 100 - 15}%` }}>PE</span>
        <span>GANANCIA</span>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────
type Tab = 'resumen' | 'costos' | 'config'

export default function PuntoEquilibrio() {
  const [tab, setTab]         = useState<Tab>('resumen')
  const [costos, setCostos]   = useState<CostoFijo[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COSTOS) || '') } catch { return DEFAULT_COSTOS }
  })
  const [config, setConfig]   = useState<Config>(() => {
    try { return JSON.parse(localStorage.getItem(LS_CONFIG) || '') } catch { return DEFAULT_CONFIG }
  })
  const [ventasMes, setVentasMes] = useState<number>(() => {
    return parseFloat(localStorage.getItem(LS_VENTAS) || '0')
  })

  // Persist
  useEffect(() => { localStorage.setItem(LS_COSTOS, JSON.stringify(costos)) }, [costos])
  useEffect(() => { localStorage.setItem(LS_CONFIG, JSON.stringify(config)) }, [config])
  useEffect(() => { localStorage.setItem(LS_VENTAS, String(ventasMes)) }, [ventasMes])

  // ── Cálculos ────────────────────────────────────────────────────
  const totalFijos      = costos.reduce((s, c) => s + c.monto, 0)
  const margenPct       = config.margen_bruto_pct / 100
  const peVentas        = margenPct > 0 ? totalFijos / margenPct : 0
  const alcanzadoPct    = peVentas > 0 ? (ventasMes / peVentas) * 100 : 0
  const gananciaEstimada = ventasMes * margenPct - totalFijos
  const faltaParaPE     = Math.max(0, peVentas - ventasMes)
  const excedente       = Math.max(0, ventasMes - peVentas)

  const estado =
    alcanzadoPct < 70  ? 'critico' :
    alcanzadoPct < 95  ? 'alerta' :
    alcanzadoPct < 105 ? 'equilibrio' : 'ganancia'

  // ── Form nuevo costo ────────────────────────────────────────────
  const [newCat,  setNewCat]  = useState(CATEGORIAS[0])
  const [newDesc, setNewDesc] = useState('')
  const [newMonto, setNewMonto] = useState('')

  function addCosto() {
    if (!newDesc.trim() || !newMonto) return
    setCostos(p => [...p, {
      id:          uid(),
      categoria:   newCat,
      descripcion: newDesc.trim(),
      monto:       parseMonto(newMonto),
    }])
    setNewDesc(''); setNewMonto('')
  }

  // ── Tabs ─────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string }[] = [
    { id: 'resumen', label: 'Resumen del Mes' },
    { id: 'costos',  label: 'Costos Fijos'    },
    { id: 'config',  label: 'Configuración'   },
  ]

  // ── Estado visual ────────────────────────────────────────────────
  const estadoConfig = {
    critico:    { label: 'Por debajo del PE — Pérdida estimada', icon: XCircle,       color: '#ef4444', bg: '#fef2f2' },
    alerta:     { label: 'Cerca del PE — Zona de atención',      icon: AlertTriangle, color: '#f59e0b', bg: '#fffbeb' },
    equilibrio: { label: 'En punto de equilibrio',               icon: Info,          color: '#3b82f6', bg: '#eff6ff' },
    ganancia:   { label: 'Por encima del PE — Ganancia estimada',icon: CheckCircle,   color: '#22c55e', bg: '#f0fdf4' },
  }[estado]

  const EstadoIcon = estadoConfig.icon

  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} style={{ color: CORAL }} />
            <p className="text-xs font-bold tracking-[2px] uppercase" style={{ color: CORAL }}>
              Análisis Financiero
            </p>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
            Punto de Equilibrio
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{mesActual()}</p>
        </div>

        {/* Ventas del mes — input siempre visible */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm min-w-[240px]">
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-1">
            Ventas del mes (manual)
          </p>
          <input
            type="number"
            value={ventasMes || ''}
            onChange={e => setVentasMes(parseFloat(e.target.value) || 0)}
            placeholder="$ 0"
            className="w-full text-lg font-bold outline-none"
            style={{ color: NAVY }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all"
            style={tab === t.id
              ? { background: NAVY, color: '#fff' }
              : { color: '#6b7280' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ─────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="space-y-5">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Costos Fijos',     value: fmt$(totalFijos),      color: '#7c3aed', note: `${costos.length} ítems` },
              { label: 'Ventas del Mes',   value: fmt$(ventasMes),       color: '#2563eb', note: 'ingresadas manualmente' },
              { label: 'Punto de Equilibrio', value: fmt$(peVentas),     color: '#d97706', note: `Margen ${config.margen_bruto_pct}%` },
              {
                label: gananciaEstimada >= 0 ? 'Ganancia Estimada' : 'Pérdida Estimada',
                value: fmt$(Math.abs(gananciaEstimada)),
                color: gananciaEstimada >= 0 ? '#16a34a' : '#dc2626',
                note:  gananciaEstimada >= 0 ? 'por encima del PE' : 'por debajo del PE',
              },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-2">
                  {k.label}
                </p>
                <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[10px] text-gray-400 mt-1">{k.note}</p>
              </div>
            ))}
          </div>

          {/* Banner de estado */}
          <div
            className="flex items-center gap-3 rounded-xl px-5 py-4 border"
            style={{ background: estadoConfig.bg, borderColor: estadoConfig.color + '33' }}
          >
            <EstadoIcon size={20} style={{ color: estadoConfig.color }} />
            <div>
              <p className="font-bold text-sm" style={{ color: estadoConfig.color }}>
                {estadoConfig.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {faltaParaPE > 0
                  ? `Necesitás vender ${fmt$(faltaParaPE)} más para cubrir todos los costos fijos.`
                  : `Superaste el PE por ${fmt$(excedente)}. La ganancia estimada es ${fmt$(gananciaEstimada)}.`}
              </p>
            </div>
          </div>

          {/* Gauge */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-sm font-bold mb-4" style={{ color: NAVY }}>
              Progreso hacia el Punto de Equilibrio
            </h3>
            <ProgressBar pct={alcanzadoPct} />

            {/* Detalle debajo del gauge */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-gray-100">
              <div className="text-center">
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Ventas</p>
                <p className="text-base font-bold mt-1" style={{ color: '#2563eb' }}>{fmt$(ventasMes)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                  {faltaParaPE > 0 ? 'Falta para PE' : 'Excedente'}
                </p>
                <p className="text-base font-bold mt-1"
                   style={{ color: faltaParaPE > 0 ? '#ef4444' : '#22c55e' }}>
                  {fmt$(faltaParaPE > 0 ? faltaParaPE : excedente)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">PE Mensual</p>
                <p className="text-base font-bold mt-1" style={{ color: '#d97706' }}>{fmt$(peVentas)}</p>
              </div>
            </div>
          </div>

          {/* Desglose de costos fijos */}
          {costos.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: NAVY }}>Desglose Costos Fijos</h3>
                <span className="text-xs text-gray-400">{fmt$(totalFijos)} / mes</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-bold tracking-widest uppercase text-gray-400">
                    <th className="text-left px-5 py-2">Categoría</th>
                    <th className="text-left px-4 py-2">Descripción</th>
                    <th className="text-right px-5 py-2">Monto</th>
                    <th className="text-right px-5 py-2">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {costos.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-5 py-2.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                          {c.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{c.descripcion}</td>
                      <td className="px-5 py-2.5 text-right font-semibold" style={{ color: NAVY }}>
                        {fmt$(c.monto)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-gray-400 text-xs">
                        {totalFijos > 0 ? ((c.monto / totalFijos) * 100).toFixed(1) : '0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={2} className="px-5 py-3 font-bold text-xs uppercase tracking-wide text-gray-500">
                      Total Costos Fijos
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-base" style={{ color: NAVY }}>
                      {fmt$(totalFijos)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400 text-xs">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Nota explicativa */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
            <Info size={15} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-600 leading-relaxed">
              <strong>¿Cómo se calcula?</strong> El PE se obtiene dividiendo los costos fijos
              totales por el margen de contribución ({config.margen_bruto_pct}%). Significa que
              necesitás vender <strong>{fmt$(peVentas)}</strong> en el mes para cubrir exactamente
              todos los costos fijos. Por encima de eso, cada peso vendido genera{' '}
              <strong>${(config.margen_bruto_pct / 100).toFixed(2)}</strong> de ganancia neta.
            </p>
          </div>
        </div>
      )}

      {/* ── TAB: COSTOS FIJOS ────────────────────────────────────── */}
      {tab === 'costos' && (
        <div className="space-y-5">

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: NAVY }}>
                Costos Fijos Mensuales
              </h3>
              <span className="text-sm font-bold" style={{ color: CORAL }}>
                {fmt$(totalFijos)} / mes
              </span>
            </div>

            {costos.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">
                Sin costos cargados. Agregá el primero abajo.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-bold tracking-widest uppercase text-gray-400">
                    <th className="text-left px-5 py-2">Categoría</th>
                    <th className="text-left px-4 py-2">Descripción</th>
                    <th className="text-right px-5 py-2">Monto mensual</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {costos.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                      <td className="px-5 py-2.5">
                        <select
                          value={c.categoria}
                          onChange={e => setCostos(p => p.map(x =>
                            x.id === c.id ? { ...x, categoria: e.target.value } : x))}
                          className="text-xs font-semibold bg-gray-100 rounded-full px-2 py-0.5 border-0 outline-none cursor-pointer"
                        >
                          {CATEGORIAS.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          value={c.descripcion}
                          onChange={e => setCostos(p => p.map(x =>
                            x.id === c.id ? { ...x, descripcion: e.target.value } : x))}
                          className="w-full outline-none text-gray-700 bg-transparent"
                        />
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <input
                          type="number"
                          value={c.monto || ''}
                          onChange={e => setCostos(p => p.map(x =>
                            x.id === c.id ? { ...x, monto: parseFloat(e.target.value) || 0 } : x))}
                          className="w-36 text-right outline-none font-semibold bg-transparent"
                          style={{ color: NAVY }}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => setCostos(p => p.filter(x => x.id !== c.id))}
                          className="text-red-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={2} className="px-5 py-3 font-bold text-xs uppercase tracking-wide text-gray-500">
                      Total
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-base" style={{ color: NAVY }}>
                      {fmt$(totalFijos)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Formulario agregar */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">
              Agregar costo fijo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              >
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Descripción (ej: Alquiler local Luro)"
                className="sm:col-span-2 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                onKeyDown={e => e.key === 'Enter' && addCosto()}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newMonto}
                  onChange={e => setNewMonto(e.target.value)}
                  placeholder="$ Monto"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                  onKeyDown={e => e.key === 'Enter' && addCosto()}
                />
                <button
                  onClick={addCosto}
                  disabled={!newDesc.trim() || !newMonto}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-opacity disabled:opacity-40"
                  style={{ background: CORAL }}
                >
                  <Plus size={15} />
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CONFIGURACIÓN ───────────────────────────────────── */}
      {tab === 'config' && (
        <div className="space-y-5 max-w-lg">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold mb-1" style={{ color: NAVY }}>
                Margen Bruto Promedio
              </h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                ¿Qué porcentaje de cada venta queda después de restar el costo de la mercadería?
                Por ejemplo, si vendés a $1.000 algo que te costó $650, tu margen es 35%.
              </p>

              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={80}
                  step={0.5}
                  value={config.margen_bruto_pct}
                  onChange={e => setConfig(p => ({ ...p, margen_bruto_pct: parseFloat(e.target.value) }))}
                  className="flex-1 accent-orange-500"
                />
                <div className="flex items-center border-2 rounded-xl overflow-hidden" style={{ borderColor: CORAL }}>
                  <input
                    type="number"
                    min={1}
                    max={80}
                    step={0.5}
                    value={config.margen_bruto_pct}
                    onChange={e => setConfig(p => ({ ...p, margen_bruto_pct: parseFloat(e.target.value) || 1 }))}
                    className="w-16 text-center text-xl font-bold outline-none py-2"
                    style={{ color: CORAL }}
                  />
                  <span className="pr-3 font-bold text-lg" style={{ color: CORAL }}>%</span>
                </div>
              </div>
            </div>

            {/* Vista previa del impacto */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-3">
                Impacto con este margen
              </p>
              {[
                ['Costos fijos a cubrir',      fmt$(totalFijos)],
                ['PE necesario (ventas/mes)',   fmt$(peVentas)],
                ['Ganancia por peso vendido',   `$ ${(config.margen_bruto_pct / 100).toFixed(2)}`],
                ['Ventas actuales',             fmt$(ventasMes)],
                ['Resultado estimado',          (gananciaEstimada >= 0 ? '+ ' : '- ') + fmt$(Math.abs(gananciaEstimada))],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-bold" style={{ color: NAVY }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>
                Este margen aplica a todas las ventas. En el futuro podrás definirlo
                por categoría de producto cuando tengas el control de costos por ítem.
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
