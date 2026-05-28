import { useState, useEffect, useCallback, useRef } from 'react'
import { api, fmt$ } from '../api'
import {
  Plus, Trash2, Lock, Unlock,
  ArrowDownCircle, ArrowUpCircle, CreditCard, Banknote,
  FileDown, History, CalendarDays, CheckCircle2,
} from 'lucide-react'

const CORAL = '#C8603A'
const NAVY  = '#070614'

// ── Types ─────────────────────────────────────────────────────────
type Mov = { id: number; tipo: string; descripcion: string; monto: number }

type Caja = {
  id: number; fecha: string; sucursal: string
  efectivo_del_dia: number
  tarjeta_provincia: number; tarjeta_nave: number
  tarjeta_frances: number;  tarjeta_comafi: number
  observaciones: string; cerrada: boolean
  movimientos: Mov[]
  total_gastos: number; total_transf: number
  total_retiros: number; total_tarjetas: number
  total_del_dia: number; total_salidas: number
}

const SUCURSALES = [
  { key: 'luro',          label: 'Luro'          },
  { key: 'independencia', label: 'Independencia' },
]

const TERMINALES = [
  { key: 'provincia', label: 'PROVINCIA' },
  { key: 'nave',      label: 'NAVE'      },
  { key: 'frances',   label: 'FRANCÉS'   },
  { key: 'comafi',    label: 'COMAFI'    },
]

// ── Helpers ───────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const dow = days[new Date(`${iso}T12:00:00`).getDay()]
  return `${dow} ${d}/${m}/${y}`
}

// ── InlineRow ─────────────────────────────────────────────────────
function InlineRow({ mov, disabled, onChange, onDelete }: {
  mov: Mov; disabled: boolean
  onChange: (id: number, patch: Partial<Mov>) => void
  onDelete: (id: number) => void
}) {
  const [desc,  setDesc]  = useState(mov.descripcion)
  const [monto, setMonto] = useState(String(mov.monto || ''))

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <input value={desc} onChange={e => setDesc(e.target.value)}
        onBlur={() => { if (desc !== mov.descripcion) onChange(mov.id, { descripcion: desc }) }}
        disabled={disabled} placeholder="Descripción…"
        className="flex-1 text-sm bg-transparent border-b border-gray-200 focus:border-gray-400 outline-none px-1 py-0.5 disabled:opacity-50" />
      <input value={monto} onChange={e => setMonto(e.target.value)}
        onBlur={() => { const n = parseFloat(monto)||0; if (n !== mov.monto) onChange(mov.id, { monto: n }) }}
        disabled={disabled} inputMode="decimal" placeholder="0"
        className="w-28 text-sm text-right bg-transparent border-b border-gray-200 focus:border-gray-400 outline-none px-1 py-0.5 disabled:opacity-50" />
      {!disabled && (
        <button onClick={() => onDelete(mov.id)}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity shrink-0">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────
function Section({ title, icon, color, total, items, tipo, disabled, onAdd, onChange, onDelete }: {
  title: string; icon: React.ReactNode; color: string; total: number
  items: Mov[]; tipo: string; disabled: boolean
  onAdd: (tipo: string, desc: string, monto: number) => void
  onChange: (id: number, patch: Partial<Mov>) => void
  onDelete: (id: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [desc,   setDesc]   = useState('')
  const [monto,  setMonto]  = useState('')
  const descRef = useRef<HTMLInputElement>(null)

  function startAdd() { setAdding(true); setTimeout(() => descRef.current?.focus(), 50) }
  function confirmAdd() {
    const n = parseFloat(monto) || 0
    if (desc.trim() || n) onAdd(tipo, desc.trim(), n)
    setDesc(''); setMonto(''); setAdding(false)
  }
  function cancelAdd() { setDesc(''); setMonto(''); setAdding(false) }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100"
           style={{ borderLeftWidth: 3, borderLeftColor: color }}>
        <span style={{ color }}>{icon}</span>
        <span className="font-bold text-sm text-gray-800 flex-1">{title}</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${color}18`, color }}>{fmt$(total)}</span>
      </div>
      <div className="px-4 flex-1">
        {items.length === 0 && !adding && (
          <p className="text-gray-300 text-xs py-3 text-center">Sin registros</p>
        )}
        {items.map(m => (
          <InlineRow key={m.id} mov={m} disabled={disabled} onChange={onChange} onDelete={onDelete} />
        ))}
        {adding && (
          <div className="flex items-center gap-2 py-2 border-t border-dashed border-gray-200 mt-1">
            <input ref={descRef} value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Descripción…"
              onKeyDown={e => { if (e.key==='Enter') confirmAdd(); if (e.key==='Escape') cancelAdd() }}
              className="flex-1 text-sm border-b outline-none px-1 py-0.5" style={{ borderBottomColor: color }} />
            <input value={monto} onChange={e => setMonto(e.target.value)} inputMode="decimal" placeholder="0"
              onKeyDown={e => { if (e.key==='Enter') confirmAdd(); if (e.key==='Escape') cancelAdd() }}
              className="w-28 text-sm text-right border-b outline-none px-1 py-0.5" style={{ borderBottomColor: color }} />
            <button onClick={confirmAdd} className="text-green-500 hover:text-green-700 text-xs font-bold">✓</button>
            <button onClick={cancelAdd}  className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
        )}
      </div>
      {!disabled && (
        <div className="px-4 py-2 border-t border-gray-50">
          <button onClick={startAdd} className="flex items-center gap-1 text-xs font-semibold transition-colors" style={{ color }}>
            <Plus size={13} /> Agregar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Historial row ─────────────────────────────────────────────────
function HistorialRow({ c, onVer, onPdf }: { c: Caja; onVer: () => void; onPdf: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 px-1 rounded-lg transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-800">{fmtDate(c.fecha)}</p>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={c.cerrada
                  ? { background: '#fee2e2', color: '#dc2626' }
                  : { background: '#dcfce7', color: '#16a34a' }}>
            {c.cerrada ? 'Cerrada' : 'Abierta'}
          </span>
        </div>
        <div className="flex gap-4 mt-0.5">
          <span className="text-xs text-gray-400">Total: <b className="text-gray-700">{fmt$(c.total_del_dia)}</b></span>
          <span className="text-xs text-gray-400">Gastos: <b className="text-red-500">{fmt$(c.total_salidas)}</b></span>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onVer}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
          style={{ background: NAVY, color: 'white' }}>
          Ver
        </button>
        <button onClick={onPdf}
          className="text-xs px-2 py-1.5 rounded-lg font-semibold border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors flex items-center gap-1">
          <FileDown size={12} /> PDF
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function CajaDiaria() {
  const [tab,      setTab]      = useState<'caja'|'historial'>('caja')
  const [fecha,    setFecha]    = useState(today())
  const [sucursal, setSucursal] = useState<string>('luro')
  const [caja,     setCaja]     = useState<Caja | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [closing,  setClosing]  = useState(false)
  const [historial,setHistorial]= useState<Caja[]>([])
  const [histLoading, setHistLoading] = useState(false)

  // ── Load caja del día ────────────────────────────────────────
  const loadCaja = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<Caja>(`/caja-diaria/${fecha}/${sucursal}`)
      setCaja(data)
    } finally { setLoading(false) }
  }, [fecha, sucursal])

  useEffect(() => { if (tab === 'caja') loadCaja() }, [loadCaja, tab])

  // ── Load historial ───────────────────────────────────────────
  const loadHistorial = useCallback(async () => {
    setHistLoading(true)
    try {
      const data = await api.get<Caja[]>(`/caja-diaria/historial/${sucursal}`)
      setHistorial(data)
    } finally { setHistLoading(false) }
  }, [sucursal])

  useEffect(() => { if (tab === 'historial') loadHistorial() }, [loadHistorial, tab])

  // ── Patch caja ───────────────────────────────────────────────
  async function patchCaja(patch: Record<string, unknown>) {
    if (!caja) return
    const updated = await api.put<Caja>(`/caja-diaria/${caja.id}`, patch)
    setCaja(updated)
  }

  // ── Cerrar / Reabrir caja ────────────────────────────────────
  async function toggleCerrar() {
    if (!caja) return
    setClosing(true)
    try {
      await patchCaja({ cerrada: !caja.cerrada })
      // Forzar recarga del historial la próxima vez que se abra ese tab
      setHistorial([])
    } finally { setClosing(false) }
  }

  // ── Movimientos ──────────────────────────────────────────────
  async function addMov(tipo: string, descripcion: string, monto: number) {
    if (!caja) return
    await api.post(`/caja-diaria/${caja.id}/movimientos`, { tipo, descripcion, monto })
    const updated = await api.get<Caja>(`/caja-diaria/${fecha}/${sucursal}`)
    setCaja(updated)
  }
  async function updateMov(id: number, patch: Partial<Mov>) {
    await api.put(`/caja-diaria/movimientos/${id}`, patch)
    const updated = await api.get<Caja>(`/caja-diaria/${fecha}/${sucursal}`)
    setCaja(updated)
  }
  async function deleteMov(id: number) {
    await api.delete(`/caja-diaria/movimientos/${id}`)
    const updated = await api.get<Caja>(`/caja-diaria/${fecha}/${sucursal}`)
    setCaja(updated)
  }

  // ── PDF download ─────────────────────────────────────────────
  async function downloadPdf(cajaId: number, fecha: string, suc: string) {
    await api.pdf(`/caja-diaria/pdf/${cajaId}`, `caja_${suc}_${fecha}.pdf`)
  }

  // ── Ver día desde historial ──────────────────────────────────
  function verDia(c: Caja) {
    setFecha(c.fecha)
    setSucursal(c.sucursal)
    setTab('caja')
  }

  const disabled = !!caja?.cerrada

  const gastos  = caja?.movimientos.filter(m => m.tipo === 'gasto')         ?? []
  const transf  = caja?.movimientos.filter(m => m.tipo === 'transferencia') ?? []
  const retiros = caja?.movimientos.filter(m => m.tipo === 'retiro')        ?? []

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caja Diaria</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {sucursal === 'luro' ? 'Sucursal Luro' : 'Sucursal Independencia'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
          <button onClick={() => setTab('caja')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all"
            style={tab === 'caja' ? { background: NAVY, color: 'white' } : { color: '#9ca3af' }}>
            <CalendarDays size={14} /> Caja del día
          </button>
          <button onClick={() => setTab('historial')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all"
            style={tab === 'historial' ? { background: NAVY, color: 'white' } : { color: '#9ca3af' }}>
            <History size={14} /> Historial
          </button>
        </div>
      </div>

      {/* ── Filters (shared) ── */}
      <div className="flex flex-wrap gap-3">
        {tab === 'caja' && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Fecha</span>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="text-sm font-semibold text-gray-700 outline-none bg-transparent" />
          </div>
        )}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
          {SUCURSALES.map(s => (
            <button key={s.key} onClick={() => setSucursal(s.key)}
              className="px-4 py-2 text-sm font-semibold transition-all"
              style={sucursal === s.key ? { background: NAVY, color: 'white' } : { color: '#9ca3af' }}>
              {s.label}
            </button>
          ))}
        </div>
        {tab === 'caja' && caja && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
               style={caja.cerrada
                 ? { background: '#fee2e2', color: '#dc2626' }
                 : { background: '#dcfce7', color: '#16a34a' }}>
            <div className="w-1.5 h-1.5 rounded-full"
                 style={{ background: caja.cerrada ? '#dc2626' : '#16a34a' }} />
            {caja.cerrada ? 'CERRADA' : 'ABIERTA'}
          </div>
        )}
      </div>

      {/* ══════════════ TAB: CAJA DEL DÍA ══════════════ */}
      {tab === 'caja' && (
        <>
          {loading && <div className="text-center py-12 text-gray-400">Cargando…</div>}

          {caja && !loading && (
            <>
              {/* ── 4 sections ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Section title="Gastos" icon={<ArrowUpCircle size={16}/>} color="#ef4444"
                  total={caja.total_gastos} items={gastos} tipo="gasto" disabled={disabled}
                  onAdd={addMov} onChange={updateMov} onDelete={deleteMov} />
                <Section title="Transferencias" icon={<ArrowDownCircle size={16}/>} color="#2563eb"
                  total={caja.total_transf} items={transf} tipo="transferencia" disabled={disabled}
                  onAdd={addMov} onChange={updateMov} onDelete={deleteMov} />
                <Section title="Retiro de Caja" icon={<Banknote size={16}/>} color="#f59e0b"
                  total={caja.total_retiros} items={retiros} tipo="retiro" disabled={disabled}
                  onAdd={addMov} onChange={updateMov} onDelete={deleteMov} />

                {/* Tarjetas */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100"
                       style={{ borderLeftWidth: 3, borderLeftColor: '#8b5cf6' }}>
                    <CreditCard size={16} style={{ color: '#8b5cf6' }} />
                    <span className="font-bold text-sm text-gray-800 flex-1">Tarjetas</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: '#8b5cf618', color: '#8b5cf6' }}>
                      {fmt$(caja.total_tarjetas)}
                    </span>
                  </div>
                  <div className="px-4 py-2 flex-1 space-y-1">
                    {TERMINALES.map(t => {
                      const key = `tarjeta_${t.key}` as keyof Caja
                      const val = caja[key] as number
                      return (
                        <div key={t.key} className="flex items-center gap-3 py-1.5">
                          <span className="text-xs font-bold text-gray-400 w-24 shrink-0">{t.label}</span>
                          <input defaultValue={val || ''} disabled={disabled} inputMode="decimal" placeholder="0"
                            onBlur={e => { const n = parseFloat(e.target.value)||0; if (n !== val) patchCaja({ [key]: n }) }}
                            className="flex-1 text-sm text-right border-b border-gray-200 focus:border-purple-400 outline-none px-1 py-0.5 bg-transparent disabled:opacity-50" />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ── Efectivo del día ── */}
              <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Efectivo del día</p>
                  <p className="text-xs text-gray-400">Cantidad contada en caja al cierre</p>
                </div>
                <input key={caja.id+'-ef'} defaultValue={caja.efectivo_del_dia||''} disabled={disabled}
                  inputMode="decimal" placeholder="0,00"
                  onBlur={e => { const n = parseFloat(e.target.value)||0; if (n !== caja.efectivo_del_dia) patchCaja({ efectivo_del_dia: n }) }}
                  className="w-36 text-right text-xl font-bold text-gray-800 border-b-2 focus:outline-none px-2 py-1 bg-transparent disabled:opacity-50"
                  style={{ borderBottomColor: CORAL }} />
              </div>

              {/* ── Resumen ── */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100" style={{ background: NAVY }}>
                  <p className="text-white/60 text-[11px] font-bold tracking-[2px] uppercase">Resumen del día</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100">
                  {[
                    { label: 'Transferencias', value: caja.total_transf,    color: '#2563eb' },
                    { label: 'Efectivo',        value: caja.efectivo_del_dia, color: '#16a34a' },
                    { label: 'Tarjetas',        value: caja.total_tarjetas,   color: '#8b5cf6' },
                    { label: 'Gastos + Retiros', value: -caja.total_salidas,  color: '#ef4444' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-5 py-4">
                      <p className="text-xs text-gray-400 font-semibold mb-1">{label}</p>
                      <p className="text-lg font-bold" style={{ color }}>
                        {value < 0 ? `- ${fmt$(-value)}` : fmt$(value)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between" style={{ background: '#f8f7f5' }}>
                  <p className="font-bold text-gray-600 text-sm uppercase tracking-wide">Total del día</p>
                  <p className="text-3xl font-bold" style={{ color: CORAL }}>{fmt$(caja.total_del_dia)}</p>
                </div>
              </div>

              {/* ── Observaciones ── */}
              <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Observaciones del día</p>
                <textarea key={caja.id+'-obs'} defaultValue={caja.observaciones} disabled={disabled} rows={2}
                  onBlur={e => { if (e.target.value !== caja.observaciones) patchCaja({ observaciones: e.target.value }) }}
                  placeholder="Anotá cualquier novedad del día…"
                  className="w-full text-sm text-gray-700 resize-none outline-none bg-transparent placeholder:text-gray-300 disabled:opacity-50" />
              </div>

              {/* ── Acciones: Cerrar + PDF ── */}
              <div className="flex gap-3">
                {/* Cerrar / Reabrir */}
                <button onClick={toggleCerrar} disabled={closing}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-60"
                  style={caja.cerrada
                    ? { background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb' }
                    : { background: NAVY, color: 'white' }}>
                  {closing
                    ? <span className="animate-pulse">Procesando…</span>
                    : caja.cerrada
                      ? <><Unlock size={16}/> Reabrir caja</>
                      : <><CheckCircle2 size={16}/> Cerrar caja del día</>
                  }
                </button>

                {/* PDF */}
                <button onClick={() => downloadPdf(caja.id, caja.fecha, caja.sucursal)}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
                  <FileDown size={16} /> PDF
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════ TAB: HISTORIAL ══════════════ */}
      {tab === 'historial' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100" style={{ background: NAVY }}>
            <p className="text-white/60 text-[11px] font-bold tracking-[2px] uppercase">
              Últimos 60 días — {sucursal === 'luro' ? 'Sucursal Luro' : 'Sucursal Independencia'}
            </p>
          </div>

          {histLoading && <div className="text-center py-10 text-gray-400">Cargando historial…</div>}

          {!histLoading && historial.length === 0 && (
            <div className="text-center py-10 text-gray-300">
              <History size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay registros todavía</p>
            </div>
          )}

          {!histLoading && historial.length > 0 && (
            <div className="px-4 py-2">
              {historial.map(c => (
                <HistorialRow key={c.id} c={c}
                  onVer={() => verDia(c)}
                  onPdf={() => downloadPdf(c.id, c.fecha, c.sucursal)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
