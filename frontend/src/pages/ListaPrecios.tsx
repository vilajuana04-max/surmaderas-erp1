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

  const esMel = tipo === 'difusion' ? 'difusión' : 'caja'
  const grupos = agrupar(placas)
  const tablas = grupos.map(({ categoria, items }) => `
    <div class="cat">
      <table>
        <tr class="cathead">
          <td class="cnombre" colspan="3">${categoria}</td>
          <td class="cprecio">Placa entera</td>
          <td class="cprecio">½ placa</td>
        </tr>
        ${items.map((p, i) => `
          <tr class="${i % 2 ? 'odd' : ''}">
            <td class="nombre">${p.nombre}</td>
            <td class="medida">${p.medida}</td>
            <td class="espesor">${p.espesor}</td>
            <td class="precio entera">${money(p.precio_placa_entera)}</td>
            <td class="precio media">${money(p.precio_media_placa)}</td>
          </tr>`).join('')}
      </table>
    </div>`).join('')

  const bloqueDescuentos = (tipo === 'caja' && clientes.length > 0) ? `
    <div class="descuentos">
      <div class="dtitulo">Descuentos especiales · uso interno</div>
      <div class="dgrid">
        ${clientes.map(c => `<div class="dcard"><span class="dnom">${c.nombre}</span><span class="ddesc">${c.porcentaje_descuento > 0 ? c.porcentaje_descuento + '%' : ''}${c.notas ? ' · ' + c.notas : ''}</span></div>`).join('')}
      </div>
    </div>` : ''

  // Logo SVG on-brand: planchas apiladas (placas) en navy + coral
  const logoSvg = `<svg viewBox="0 0 48 48" width="46" height="46" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="13" fill="${NAVY}"/>
    <rect x="11" y="13" width="26" height="6" rx="3" fill="${CORAL}"/>
    <rect x="11" y="21.5" width="26" height="6" rx="3" fill="${CORAL}" opacity="0.72"/>
    <rect x="11" y="30" width="26" height="6" rx="3" fill="${CORAL}" opacity="0.45"/>
  </svg>`

  const waSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.847-1.007z"/></svg>`
  const webSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${CORAL}" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg>`
  const igSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${CORAL}" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="${CORAL}" stroke="none"/></svg>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lista ${esMel} — ${fechaFile}</title>
<style>
  @page { size: A4; margin: 1cm 1.2cm; }
  * { box-sizing: border-box; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 9.5pt; margin: 0; }

  /* ── Header ── */
  .hdr { display: flex; align-items: center; justify-content: space-between;
         background: ${NAVY}; border-radius: 16px; padding: 14px 20px; margin-bottom: 8px; }
  .brand { display: flex; align-items: center; gap: 13px; }
  .wm1 { color: #fff; font-size: 17pt; font-weight: 800; letter-spacing: 1px; line-height: 1; }
  .wm2 { color: rgba(255,255,255,.55); font-size: 7.5pt; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px; }
  .contact { display: flex; flex-direction: column; gap: 3px; }
  .contact .row { display: flex; align-items: center; gap: 6px; font-size: 8.5pt; color: rgba(255,255,255,.85); }
  .fechawrap { text-align: right; }
  .fechalbl { color: rgba(255,255,255,.5); font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; }
  .fecha { display: inline-block; background: ${CORAL}; color: #fff; font-weight: 700; font-size: 12pt;
           padding: 3px 12px; border-radius: 8px; margin-top: 3px; }

  /* ── Diagramas ── */
  .diagramas { display: flex; gap: 16px; margin: 12px 0 14px; }
  .diag { border: 1px solid #ececec; border-radius: 10px; padding: 8px 10px; display: flex; align-items: center; gap: 10px; }
  .diag p { margin: 0; font-size: 8.5pt; color: #555; font-weight: 600; }
  .box { width: 42px; height: 32px; border-radius: 4px; flex: 0 0 auto; }
  .box.entera { background: ${NAVY}; }
  .box.vert { background: #fff; border: 1.5px solid ${NAVY}; position: relative; overflow: hidden; }
  .box.vert::after { content: ''; position: absolute; right: 0; top: 0; width: 50%; height: 100%; background: ${NAVY}; }
  .box.horiz { background: #fff; border: 1.5px solid ${NAVY}; position: relative; overflow: hidden; }
  .box.horiz::after { content: ''; position: absolute; left: 0; bottom: 0; width: 100%; height: 50%; background: ${NAVY}; }

  /* ── Tablas por categoría ── */
  .cat { border-radius: 10px; overflow: hidden; border: 1px solid #ececec; margin-bottom: 9px; }
  .cat table { width: 100%; border-collapse: collapse; }
  .cat td { padding: 5px 10px; font-size: 9pt; border-bottom: 1px solid #f0f0f0; }
  .cathead td { border-bottom: none; font-weight: 700; }
  .cathead .cnombre { background: ${CORAL}; color: #fff; text-transform: uppercase; letter-spacing: .5px; font-size: 9pt; }
  .cathead .cprecio { background: ${NAVY}; color: #fff; text-align: center; width: 120px; font-size: 8.5pt; }
  tr.odd td { background: #faf7f5; }
  .nombre { font-weight: 600; color: #222; }
  .medida { text-align: center; color: #666; width: 110px; }
  .espesor { text-align: center; color: #666; width: 64px; }
  .precio { text-align: right; width: 120px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .precio.entera { font-weight: 700; color: ${NAVY}; }
  .precio.media { color: #888; }

  /* ── Pie ── */
  .pie { margin-top: 12px; padding: 9px 14px; background: #faf7f5; border-left: 3px solid ${CORAL};
         border-radius: 6px; font-size: 9pt; font-weight: 600; color: #444; }
  .descuentos { margin-top: 14px; }
  .dtitulo { font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px; color: ${CORAL}; font-weight: 700; margin-bottom: 6px; }
  .dgrid { display: flex; flex-wrap: wrap; gap: 8px; }
  .dcard { border: 1px solid #ececec; border-radius: 8px; padding: 6px 12px; display: flex; flex-direction: column; }
  .dnom { font-weight: 700; color: #222; font-size: 9.5pt; }
  .ddesc { font-size: 8pt; color: ${CORAL}; font-weight: 600; }
</style></head><body>
  <div class="hdr">
    <div class="brand">
      ${logoSvg}
      <div>
        <div class="wm1">SUR MADERAS</div>
        <div class="wm2">Mar del Plata · Placas a medida</div>
      </div>
    </div>
    <div class="contact">
      <div class="row">${waSvg} Contactar por WhatsApp</div>
      <div class="row">${webSvg} surmaderas.com.ar</div>
      <div class="row">${igSvg} Surmaderas.mdp</div>
    </div>
    <div class="fechawrap">
      <div class="fechalbl">Vigente</div>
      <div class="fecha">${fechaVig}</div>
    </div>
  </div>

  <div class="diagramas">
    <div class="diag"><div class="box entera"></div><p>Placa entera</p></div>
    <div class="diag"><div class="box vert"></div><p>½ placa vertical</p></div>
    <div class="diag"><div class="box horiz"></div><p>½ placa horizontal</p></div>
  </div>

  ${tablas}

  <div class="pie">Los precios incluyen IVA y pueden ser modificados sin previo aviso</div>
  ${bloqueDescuentos}
  <script>window.onload=function(){document.title='${fechaFile}_Lista_${tipo}';window.print()}</script>
</body></html>`

  const w = window.open('', '_blank', 'width=980,height=760')
  if (w) { w.document.write(html); w.document.close() }
}
