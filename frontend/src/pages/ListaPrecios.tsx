import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import {
  FileDown, History, TrendingUp, Settings2, X, Tag, Plus, Trash2,
  Pencil, GitCompareArrows, AlertTriangle,
} from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'

/* ── Tipos ─────────────────────────────────────────────────────── */
interface Placa {
  id: number; categoria: string; nombre: string; medida: string; espesor: string
  precio_placa_entera: number; precio_media_placa: number; activo: boolean
  orden: number; updated_at: string | null
}
interface HistRow {
  id: number; placa_id: number; placa_nombre: string
  precio_anterior: number; precio_nuevo: number; diff: number; diff_pct: number
  motivo: string; usuario: string; created_at: string | null
}
interface CompRow {
  id: number; categoria: string; nombre: string; espesor: string; medida: string
  actual: number; anterior: number | null; diff: number | null; diff_pct: number | null
  cambio_fecha: string | null
}
interface ClienteDesc { id: number; nombre: string; porcentaje_descuento: number; notas: string; orden: number }

type Vista = 'tabla' | 'comparador' | 'historial'

/* ── Helpers ───────────────────────────────────────────────────── */
const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtFecha = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
const fmtFechaHora = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

/* Orden de categorías tal como aparecen en la lista */
function agrupar(placas: Placa[]): { categoria: string; items: Placa[] }[] {
  const orden: string[] = []
  const map: Record<string, Placa[]> = {}
  for (const p of placas) {
    if (!map[p.categoria]) { map[p.categoria] = []; orden.push(p.categoria) }
    map[p.categoria].push(p)
  }
  return orden.map(c => ({ categoria: c, items: map[c] }))
}

/* ═══════════════════════════════════════════════════════════════ */
export default function ListaPrecios() {
  const { user } = useAuth()
  const usuario = user?.username || 'Sistema'

  const [placas, setPlacas]   = useState<Placa[]>([])
  const [pctMedia, setPctMedia] = useState(65)
  const [loading, setLoading] = useState(true)
  const [vista, setVista]     = useState<Vista>('tabla')

  const [showActualizador, setShowActualizador] = useState(false)
  const [showConfig, setShowConfig]       = useState(false)
  const [showClientes, setShowClientes]   = useState(false)
  const [histPlaca, setHistPlaca]         = useState<Placa | null>(null)

  const load = () => {
    setLoading(true)
    api.get<{ porcentaje_media_placa: number; placas: Placa[] }>('/placas')
      .then(d => { setPlacas(d.placas); setPctMedia(d.porcentaje_media_placa) })
      .catch(() => setPlacas([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const grupos = useMemo(() => agrupar(placas), [placas])

  /* ── Edición inline de precio ── */
  const savePrecio = async (p: Placa, nuevo: number) => {
    if (nuevo === p.precio_placa_entera) return
    try {
      await api.put(`/placas/${p.id}/precio`, { precio_nuevo: nuevo, motivo: 'Edición manual', usuario })
      load()
    } catch (e) { alert('Error al guardar: ' + (e instanceof Error ? e.message : e)) }
  }

  return (
    <div className="max-w-6xl mx-auto pb-16">
      {/* ── Header ── */}
      <div className="rounded-2xl p-6 mb-5" style={{ background: NAVY }}>
        <p className="text-[11px] font-bold tracking-[3px] uppercase mb-1" style={{ color: CORAL }}>Sur Maderas · ERP</p>
        <h1 className="text-3xl font-bold text-white">Lista de Precios</h1>
        <p className="text-white/50 text-sm mb-4">Placas de madera — un precio centralizado, sin errores</p>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowActualizador(true)}
            className="flex items-center gap-2 text-sm font-bold text-white px-4 py-2 rounded-xl" style={{ background: CORAL }}>
            <TrendingUp size={16} /> Actualizar precios
          </button>
          <button onClick={() => exportarPDF('difusion', placas, pctMedia, [])}
            className="flex items-center gap-2 text-sm font-semibold text-white/90 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20">
            <FileDown size={16} /> PDF Difusión
          </button>
          <button onClick={async () => {
            const cds = await api.get<ClienteDesc[]>('/placas/clientes-descuento').catch(() => [])
            exportarPDF('caja', placas, pctMedia, cds)
          }}
            className="flex items-center gap-2 text-sm font-semibold text-white/90 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20">
            <FileDown size={16} /> PDF Caja
          </button>
          <button onClick={() => setShowClientes(true)}
            className="flex items-center gap-2 text-sm font-semibold text-white/90 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20">
            <Tag size={16} /> Descuentos
          </button>
          <button onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 text-sm font-semibold text-white/90 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20">
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* ── Tabs de vista ── */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {([['tabla', 'Tabla de precios', Tag], ['comparador', 'Comparador', GitCompareArrows], ['historial', 'Historial', History]] as const).map(([v, label, Icon]) => (
          <button key={v} onClick={() => setVista(v)}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all ${vista === v ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            style={vista === v ? { color: NAVY } : {}}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-center py-16 text-gray-400 text-sm">Cargando lista…</p>}

      {!loading && vista === 'tabla' && (
        <TablaPrecios grupos={grupos} pctMedia={pctMedia} onSavePrecio={savePrecio} onHist={setHistPlaca} />
      )}
      {!loading && vista === 'comparador' && <Comparador />}
      {!loading && vista === 'historial' && <HistorialGlobal />}

      {/* ── Modales ── */}
      {showActualizador && (
        <Actualizador placas={placas} usuario={usuario} onClose={() => setShowActualizador(false)} onDone={() => { setShowActualizador(false); load() }} />
      )}
      {showConfig && (
        <ConfigModal pct={pctMedia} onClose={() => setShowConfig(false)} onSaved={p => { setPctMedia(p); setShowConfig(false); load() }} />
      )}
      {showClientes && <ClientesModal onClose={() => setShowClientes(false)} />}
      {histPlaca && <HistorialPlaca placa={histPlaca} onClose={() => setHistPlaca(null)} />}
    </div>
  )
}

/* ── Tabla principal ───────────────────────────────────────────── */
function TablaPrecios({ grupos, pctMedia, onSavePrecio, onHist }: {
  grupos: { categoria: string; items: Placa[] }[]
  pctMedia: number
  onSavePrecio: (p: Placa, n: number) => void
  onHist: (p: Placa) => void
}) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-400">1/2 placa = <b>{pctMedia}%</b> del precio entero · Hacé clic en un precio para editarlo</p>
      {grupos.map(({ categoria, items }) => (
        <div key={categoria} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-2.5" style={{ background: '#e9e7e4' }}>
            <p className="text-sm font-bold" style={{ color: NAVY }}>{categoria}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="text-left px-5 py-2 font-semibold">Material</th>
                  <th className="text-left px-3 py-2 font-semibold">Medida</th>
                  <th className="text-left px-3 py-2 font-semibold">Espesor</th>
                  <th className="text-right px-3 py-2 font-semibold">Placa entera</th>
                  <th className="text-right px-3 py-2 font-semibold">1/2 placa</th>
                  <th className="text-right px-3 py-2 font-semibold">Actualizado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 font-semibold text-gray-700">{p.nombre}</td>
                    <td className="px-3 py-2.5 text-gray-500">{p.medida}</td>
                    <td className="px-3 py-2.5 text-gray-500">{p.espesor}</td>
                    <td className="px-3 py-2.5 text-right">
                      <PrecioCell value={p.precio_placa_entera} onSave={n => onSavePrecio(p, n)} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400 tabular-nums">{fmt$(p.precio_media_placa)}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-gray-300">{fmtFecha(p.updated_at)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => onHist(p)} className="text-gray-300 hover:text-[color:var(--coral)]" style={{ ['--coral' as any]: CORAL }} title="Ver historial">
                        <History size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

/* Celda de precio editable inline */
function PrecioCell({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  if (editing) {
    return (
      <input autoFocus type="number" step="0.01" value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => { const n = parseFloat(raw); if (!isNaN(n)) onSave(n); setEditing(false) }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
        className="w-32 text-right border-2 rounded-lg px-2 py-1 text-sm font-bold outline-none tabular-nums"
        style={{ borderColor: CORAL }} />
    )
  }
  return (
    <button onClick={() => { setRaw(String(value)); setEditing(true) }}
      className="group inline-flex items-center gap-1 font-bold text-gray-800 tabular-nums hover:text-[color:var(--c)] rounded px-1"
      style={{ ['--c' as any]: CORAL }}>
      {fmt$(value)}
      <Pencil size={11} className="opacity-0 group-hover:opacity-40" />
    </button>
  )
}

/* ── Actualizador masivo (Modo A y B) ──────────────────────────── */
function Actualizador({ placas, usuario, onClose, onDone }: {
  placas: Placa[]; usuario: string; onClose: () => void; onDone: () => void
}) {
  const [modo, setModo] = useState<'A' | 'B'>('A')
  const categorias = useMemo(() => Array.from(new Set(placas.map(p => p.categoria))), [placas])

  // Modo A
  const [pct, setPct]   = useState('')
  const [cat, setCat]   = useState('')   // '' = todas
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const pctNum = parseFloat(pct)
  const afectadas = cat ? placas.filter(p => p.categoria === cat) : placas
  const preview = !isNaN(pctNum) && pctNum !== 0

  const aplicarA = async () => {
    if (isNaN(pctNum) || pctNum === 0) { alert('Ingresá un porcentaje.'); return }
    if (!confirm(`Aplicar ${pctNum > 0 ? '+' : ''}${pctNum}% a ${cat || 'TODAS las categorías'} (${afectadas.length} productos)?`)) return
    setSaving(true)
    try {
      await api.post('/placas/aumento', { porcentaje: pctNum, categoria: cat || null, motivo, usuario })
      onDone()
    } catch (e) { alert('Error: ' + (e instanceof Error ? e.message : e)); setSaving(false) }
  }

  // Modo B — proveedor + margen
  const [placaId, setPlacaId] = useState<number | ''>('')
  const [costo, setCosto]   = useState('')
  const [margen, setMargen] = useState('')
  const [motivoB, setMotivoB] = useState('')
  const costoN = parseFloat(costo), margenN = parseFloat(margen)
  const finalB = !isNaN(costoN) && !isNaN(margenN) ? costoN * (1 + margenN / 100) : null

  const aplicarB = async () => {
    if (!placaId) { alert('Elegí un material.'); return }
    if (finalB == null) { alert('Completá costo y margen.'); return }
    setSaving(true)
    try {
      await api.put(`/placas/${placaId}/precio`, {
        precio_nuevo: Math.round(finalB * 100) / 100,
        motivo: motivoB || `Proveedor $${costoN} + ${margenN}%`, usuario,
      })
      onDone()
    } catch (e) { alert('Error: ' + (e instanceof Error ? e.message : e)); setSaving(false) }
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-bold text-lg" style={{ color: NAVY }}>Actualizar precios</h3>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
      </div>

      <div className="flex gap-1 px-5 pt-4">
        {([['A', 'Aumento %'], ['B', 'Proveedor + margen']] as const).map(([m, l]) => (
          <button key={m} onClick={() => setModo(m)}
            className={`text-sm font-semibold px-4 py-2 rounded-lg ${modo === m ? 'text-white' : 'text-gray-400 bg-gray-50'}`}
            style={modo === m ? { background: CORAL } : {}}>{l}</button>
        ))}
      </div>

      {modo === 'A' && (
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase">% de aumento</label>
              <input className={inp} type="number" step="0.1" value={pct} onChange={e => setPct(e.target.value)} placeholder="Ej: 10" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase">Aplicar a</label>
              <select className={inp} value={cat} onChange={e => setCat(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase">Motivo (opcional)</label>
            <input className={inp} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: Aumento 10% julio" />
          </div>

          {preview && (
            <div className="border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-3 py-2">Material</th>
                    <th className="text-right px-3 py-2">Ahora</th>
                    <th className="text-right px-3 py-2">Quedaría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {afectadas.map(p => {
                    const nuevo = Math.round(p.precio_placa_entera * (1 + pctNum / 100) * 100) / 100
                    return (
                      <tr key={p.id}>
                        <td className="px-3 py-1.5 text-gray-600">{p.nombre} <span className="text-gray-300">{p.espesor}</span></td>
                        <td className="px-3 py-1.5 text-right text-gray-400 tabular-nums">{fmt$(p.precio_placa_entera)}</td>
                        <td className="px-3 py-1.5 text-right font-bold tabular-nums" style={{ color: CORAL }}>{fmt$(nuevo)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <button onClick={aplicarA} disabled={saving}
            className="w-full text-white py-3 rounded-xl font-bold disabled:opacity-50" style={{ background: NAVY }}>
            {saving ? 'Aplicando…' : `Confirmar aumento a ${afectadas.length} productos`}
          </button>
        </div>
      )}

      {modo === 'B' && (
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase">Material</label>
            <select className={inp} value={placaId} onChange={e => setPlacaId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Elegí un material…</option>
              {placas.map(p => <option key={p.id} value={p.id}>{p.categoria} · {p.nombre} {p.espesor}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase">Precio proveedor $</label>
              <input className={inp} type="number" step="0.01" value={costo} onChange={e => setCosto(e.target.value)} placeholder="Costo" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase">% de ganancia</label>
              <input className={inp} type="number" step="0.1" value={margen} onChange={e => setMargen(e.target.value)} placeholder="Ej: 40" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase">Motivo (opcional)</label>
            <input className={inp} value={motivoB} onChange={e => setMotivoB(e.target.value)} placeholder="Ej: Lista proveedor Fibrofácil" />
          </div>

          {finalB != null && (
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Precio final placa entera</p>
              <p className="text-3xl font-bold" style={{ color: CORAL }}>{fmt$(Math.round(finalB * 100) / 100)}</p>
            </div>
          )}

          <button onClick={aplicarB} disabled={saving}
            className="w-full text-white py-3 rounded-xl font-bold disabled:opacity-50" style={{ background: NAVY }}>
            {saving ? 'Guardando…' : 'Confirmar precio'}
          </button>
        </div>
      )}
    </Overlay>
  )
}

/* ── Comparador ────────────────────────────────────────────────── */
function Comparador() {
  const [rows, setRows] = useState<CompRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get<CompRow[]>('/placas/comparador').then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }, [])
  if (loading) return <p className="text-center py-16 text-gray-400 text-sm">Cargando…</p>

  const sinCambio = rows.filter(r => r.anterior == null)
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50">
        <p className="text-sm font-bold" style={{ color: NAVY }}>Lista actual vs. anterior</p>
        <p className="text-xs text-gray-400">Detectá productos que quedaron sin actualizar o con aumentos inconsistentes</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-50">
              <th className="text-left px-5 py-2.5">Material</th>
              <th className="text-right px-3 py-2.5">Anterior</th>
              <th className="text-right px-3 py-2.5">Actual</th>
              <th className="text-right px-3 py-2.5">Diferencia</th>
              <th className="text-right px-3 py-2.5">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(r => {
              const noCambio = r.anterior == null
              return (
                <tr key={r.id} className={noCambio ? 'bg-amber-50/40' : ''}>
                  <td className="px-5 py-2.5 font-semibold text-gray-700">
                    {r.nombre} <span className="text-gray-300 font-normal">{r.espesor}</span>
                    <span className="ml-1 text-[10px] text-gray-300">{r.categoria}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-400 tabular-nums">{r.anterior != null ? fmt$(r.anterior) : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-800 tabular-nums">{fmt$(r.actual)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: r.diff == null ? '#cbd5e1' : r.diff > 0 ? '#16a34a' : r.diff < 0 ? '#dc2626' : '#94a3b8' }}>
                    {r.diff == null ? '—' : (r.diff > 0 ? '+' : '') + fmt$(r.diff)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: r.diff_pct == null ? '#cbd5e1' : r.diff_pct > 0 ? '#16a34a' : r.diff_pct < 0 ? '#dc2626' : '#94a3b8' }}>
                    {r.diff_pct == null ? 'sin historial' : (r.diff_pct > 0 ? '+' : '') + r.diff_pct.toFixed(1) + '%'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {sinCambio.length > 0 && (
        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle size={15} />
          {sinCambio.length} producto{sinCambio.length > 1 ? 's' : ''} sin cambios registrados (fila amarilla) — revisá si quedaron sin actualizar.
        </div>
      )}
    </div>
  )
}

/* ── Historial global ──────────────────────────────────────────── */
function HistorialGlobal() {
  const [rows, setRows] = useState<HistRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get<HistRow[]>('/placas/historial').then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }, [])
  if (loading) return <p className="text-center py-16 text-gray-400 text-sm">Cargando…</p>
  if (rows.length === 0) return <p className="text-center py-16 text-gray-300 text-sm">Todavía no hay cambios registrados.</p>

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-50">
              <th className="text-left px-5 py-2.5">Fecha</th>
              <th className="text-left px-3 py-2.5">Material</th>
              <th className="text-right px-3 py-2.5">Antes</th>
              <th className="text-right px-3 py-2.5">Después</th>
              <th className="text-right px-3 py-2.5">%</th>
              <th className="text-left px-3 py-2.5">Motivo</th>
              <th className="text-left px-3 py-2.5">Usuario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(h => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-5 py-2.5 text-gray-400 text-xs whitespace-nowrap">{fmtFechaHora(h.created_at)}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-700">{h.placa_nombre}</td>
                <td className="px-3 py-2.5 text-right text-gray-400 tabular-nums">{fmt$(h.precio_anterior)}</td>
                <td className="px-3 py-2.5 text-right font-bold text-gray-800 tabular-nums">{fmt$(h.precio_nuevo)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: h.diff > 0 ? '#16a34a' : h.diff < 0 ? '#dc2626' : '#94a3b8' }}>
                  {(h.diff_pct > 0 ? '+' : '') + h.diff_pct.toFixed(1)}%
                </td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{h.motivo || '—'}</td>
                <td className="px-3 py-2.5 text-gray-400 text-xs">{h.usuario || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Historial de una placa (modal) ────────────────────────────── */
function HistorialPlaca({ placa, onClose }: { placa: Placa; onClose: () => void }) {
  const [rows, setRows] = useState<HistRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get<HistRow[]>(`/placas/${placa.id}/historial`).then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }, [placa.id])
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-lg" style={{ color: NAVY }}>{placa.nombre} {placa.espesor}</h3>
          <p className="text-xs text-gray-400">Historial de precios · {placa.medida}</p>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
      </div>
      <div className="p-5 max-h-96 overflow-y-auto">
        {loading && <p className="text-center py-8 text-gray-400 text-sm">Cargando…</p>}
        {!loading && rows.length === 0 && <p className="text-center py-8 text-gray-300 text-sm">Sin cambios registrados.</p>}
        {!loading && rows.map(h => (
          <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
            <div>
              <p className="text-xs text-gray-400">{fmtFechaHora(h.created_at)} · {h.usuario || 'Sistema'}</p>
              {h.motivo && <p className="text-xs text-gray-500">{h.motivo}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm">
                <span className="text-gray-400 line-through tabular-nums">{fmt$(h.precio_anterior)}</span>
                {' → '}
                <span className="font-bold text-gray-800 tabular-nums">{fmt$(h.precio_nuevo)}</span>
              </p>
              <p className="text-xs font-semibold" style={{ color: h.diff > 0 ? '#16a34a' : '#dc2626' }}>
                {(h.diff_pct > 0 ? '+' : '') + h.diff_pct.toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </Overlay>
  )
}

/* ── Config (% media placa) ────────────────────────────────────── */
function ConfigModal({ pct, onClose, onSaved }: { pct: number; onClose: () => void; onSaved: (p: number) => void }) {
  const [val, setVal] = useState(String(pct))
  const [saving, setSaving] = useState(false)
  const guardar = async () => {
    const n = parseFloat(val)
    if (isNaN(n) || n <= 0 || n >= 100) { alert('Ingresá un porcentaje entre 1 y 99.'); return }
    setSaving(true)
    try {
      await api.put('/placas/config', { porcentaje_media_placa: n })
      onSaved(n)
    } catch (e) { alert('Error: ' + (e instanceof Error ? e.message : e)); setSaving(false) }
  }
  return (
    <Overlay onClose={onClose} narrow>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-bold text-lg" style={{ color: NAVY }}>Configuración</h3>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
      </div>
      <div className="p-5 space-y-3">
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase">% para media placa</label>
          <div className="flex items-center gap-2">
            <input className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 text-right"
              type="number" step="0.1" value={val} onChange={e => setVal(e.target.value)} />
            <span className="text-gray-400 text-sm">% del precio entero</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">La 1/2 placa se calcula automáticamente con este porcentaje en toda la lista.</p>
        </div>
        <button onClick={guardar} disabled={saving} className="w-full text-white py-2.5 rounded-xl font-bold disabled:opacity-50" style={{ background: NAVY }}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Overlay>
  )
}

/* ── Clientes con descuento (lista de caja) ────────────────────── */
function ClientesModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<ClienteDesc[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [descuento, setDescuento] = useState('')
  const [notas, setNotas] = useState('')

  const load = () => {
    setLoading(true)
    api.get<ClienteDesc[]>('/placas/clientes-descuento').then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const agregar = async () => {
    if (!nombre.trim()) { alert('Ingresá el nombre.'); return }
    await api.post('/placas/clientes-descuento', {
      nombre: nombre.trim(), porcentaje_descuento: parseFloat(descuento) || 0, notas: notas.trim(), orden: rows.length,
    })
    setNombre(''); setDescuento(''); setNotas(''); load()
  }
  const eliminar = async (id: number) => { await api.delete(`/placas/clientes-descuento/${id}`); load() }

  const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-lg" style={{ color: NAVY }}>Clientes con descuento</h3>
          <p className="text-xs text-gray-400">Aparecen sólo en el PDF de Caja (interno)</p>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          <input className={`${inp} flex-1`} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (ej: Silvia)" />
          <input className={`${inp} w-24`} type="number" value={descuento} onChange={e => setDescuento(e.target.value)} placeholder="% desc" />
          <button onClick={agregar} className="text-white px-3 rounded-lg" style={{ background: CORAL }}><Plus size={18} /></button>
        </div>
        <input className={`${inp} w-full`} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas (opcional)" />

        <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
          {loading && <p className="text-center py-6 text-gray-400 text-sm">Cargando…</p>}
          {!loading && rows.length === 0 && <p className="text-center py-6 text-gray-300 text-sm">Sin clientes cargados.</p>}
          {rows.map(c => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm font-semibold text-gray-700">{c.nombre} {c.porcentaje_descuento > 0 && <span style={{ color: CORAL }}>· {c.porcentaje_descuento}%</span>}</p>
                {c.notas && <p className="text-xs text-gray-400">{c.notas}</p>}
              </div>
              <button onClick={() => eliminar(c.id)} className="text-red-300 hover:text-red-600"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    </Overlay>
  )
}

/* ── Overlay genérico ──────────────────────────────────────────── */
function Overlay({ children, onClose, narrow }: { children: React.ReactNode; onClose: () => void; narrow?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${narrow ? 'max-w-sm' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTACIÓN PDF — replica la lista en papel (difusión / caja)
═══════════════════════════════════════════════════════════════ */
function exportarPDF(tipo: 'difusion' | 'caja', placas: Placa[], pct: number, clientes: ClienteDesc[]) {
  const hoy = new Date()
  const fechaVig = hoy.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
  const fechaFile = `${String(hoy.getDate()).padStart(2, '0')}_${String(hoy.getMonth() + 1).padStart(2, '0')}_${String(hoy.getFullYear()).slice(2)}`
  const money = (n: number) => `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const grupos = agrupar(placas)
  const tablas = grupos.map(({ categoria, items }) => `
    <table class="cat">
      <tr class="cathead">
        <td class="cnombre" colspan="3">${categoria}</td>
        <td class="cprecio">Placa entera</td>
        <td class="cprecio">1/2 placa</td>
      </tr>
      ${items.map(p => `
        <tr>
          <td class="nombre">${p.nombre}</td>
          <td class="medida">${p.medida}</td>
          <td class="espesor">${p.espesor}</td>
          <td class="precio">${money(p.precio_placa_entera)}</td>
          <td class="precio">${money(p.precio_media_placa)}</td>
        </tr>`).join('')}
    </table>`).join('')

  const bloqueDescuentos = (tipo === 'caja' && clientes.length > 0) ? `
    <div class="descuentos">
      <table>
        ${clientes.map(c => `<tr><td class="dnom">${c.nombre}</td><td class="ddesc">${c.porcentaje_descuento > 0 ? c.porcentaje_descuento + '%' : ''} ${c.notas || ''}</td></tr>`).join('')}
      </table>
    </div>` : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lista ${tipo} — ${fechaFile}</title>
<style>
  @page { size: A4; margin: 1.2cm 1.4cm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 10pt; margin: 0; }
  .top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 58px; height: 58px; border: 1.5px solid #333;
          display: grid; grid-template-columns: repeat(5,1fr); grid-template-rows: repeat(5,1fr); }
  .logo span { border: 0.5px solid #d9d9d9; }
  .logo .lbl { grid-column: 1/6; grid-row: 3/4; border: none; display: flex; align-items: center; justify-content: center;
               font-weight: bold; font-size: 13pt; color: #333; letter-spacing: 1px; }
  .contact { font-size: 9.5pt; line-height: 1.5; }
  .contact a, .contact span.c { color: #2563eb; text-decoration: underline; }
  .contact .row { display: flex; align-items: center; gap: 6px; }
  .wa { color: #25D366; font-weight: bold; }
  .fecha { font-size: 11pt; font-weight: bold; }
  .diagramas { display: flex; gap: 40px; margin: 6px 0 16px; }
  .diag { text-align: left; }
  .diag p { margin: 0 0 4px; font-size: 9.5pt; }
  .box { width: 70px; height: 52px; }
  .box.entera { background: #000; }
  .box.vert { background: linear-gradient(90deg, #fff 50%, #000 50%); border: 1px solid #000; }
  .box.horiz { background: linear-gradient(180deg, #fff 55%, #000 55%); border: 1px solid #000; }
  table.cat { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.cat td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5pt; }
  .cathead td { background: #d0d0d0; font-weight: bold; text-align: center; }
  .cathead .cnombre { text-align: center; }
  .cathead .cprecio { width: 130px; }
  .nombre { width: auto; }
  .medida { text-align: center; width: 120px; }
  .espesor { text-align: center; width: 70px; }
  .precio { text-align: right; width: 130px; white-space: nowrap; }
  .pie { font-weight: bold; font-size: 10pt; margin-top: 10px; }
  .descuentos { margin-top: 16px; }
  .descuentos table { border-collapse: collapse; }
  .descuentos td { padding: 2px 10px; font-size: 10pt; }
  .dnom { border-left: 2px solid #000; }
  .ddesc { font-weight: bold; }
</style></head><body>
  <div class="top">
    <div class="brand">
      <div class="logo">
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
        <div class="lbl">Sur</div>
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="contact">
        <div class="row"><span class="wa">✆</span> <span class="c">Contactar por whatsapp</span></div>
        <div class="row">🌐 <span class="c">surmaderas.com.ar</span></div>
        <div class="row">◎ <span class="c">Surmaderas.mdp</span></div>
      </div>
    </div>
    <div class="fecha">${fechaVig}</div>
  </div>

  <div class="diagramas">
    <div class="diag"><p>Placa entera</p><div class="box entera"></div></div>
    <div class="diag"><p>1/2 Placa vertical</p><div class="box vert"></div></div>
    <div class="diag"><p>1/2 placa horizontal</p><div class="box horiz"></div></div>
  </div>

  ${tablas}

  <div class="pie">Los precios incluyen IVA y pueden ser modificados sin previo aviso</div>
  ${bloqueDescuentos}
  <script>window.onload=function(){document.title='${fechaFile}_Lista_${tipo}';window.print()}</script>
</body></html>`

  const w = window.open('', '_blank', 'width=980,height=760')
  if (w) { w.document.write(html); w.document.close() }
}
