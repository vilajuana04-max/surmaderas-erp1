import { useState, useEffect, useCallback, useRef } from 'react'
import { api, fmt$ } from '../api'
import {
  Plus, Trash2, Lock, Unlock, ChevronDown,
  ArrowDownCircle, ArrowUpCircle, CreditCard, Banknote,
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
function today() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── InlineRow — fila de movimiento editable ───────────────────────
function InlineRow({
  mov, disabled,
  onChange, onDelete,
}: {
  mov: Mov
  disabled: boolean
  onChange: (id: number, patch: Partial<Mov>) => void
  onDelete: (id: number) => void
}) {
  const [desc,  setDesc]  = useState(mov.descripcion)
  const [monto, setMonto] = useState(String(mov.monto || ''))

  function saveDesc() {
    if (desc !== mov.descripcion) onChange(mov.id, { descripcion: desc })
  }
  function saveMonto() {
    const n = parseFloat(monto) || 0
    if (n !== mov.monto) onChange(mov.id, { monto: n })
  }

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <input
        value={desc}
        onChange={e => setDesc(e.target.value)}
        onBlur={saveDesc}
        disabled={disabled}
        placeholder="Descripción…"
        className="flex-1 text-sm bg-transparent border-b border-gray-200 focus:border-gray-400 outline-none px-1 py-0.5 disabled:opacity-50"
      />
      <input
        value={monto}
        onChange={e => setMonto(e.target.value)}
        onBlur={saveMonto}
        disabled={disabled}
        inputMode="decimal"
        placeholder="0"
        className="w-28 text-sm text-right bg-transparent border-b border-gray-200 focus:border-gray-400 outline-none px-1 py-0.5 disabled:opacity-50"
      />
      {!disabled && (
        <button
          onClick={() => onDelete(mov.id)}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity shrink-0"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────
function Section({
  title, icon, color, total, items, tipo, cajaId, disabled,
  onAdd, onChange, onDelete,
}: {
  title:    string
  icon:     React.ReactNode
  color:    string
  total:    number
  items:    Mov[]
  tipo:     string
  cajaId:   number
  disabled: boolean
  onAdd:    (tipo: string, desc: string, monto: number) => void
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
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100"
           style={{ borderLeftWidth: 3, borderLeftColor: color }}>
        <span style={{ color }}>{icon}</span>
        <span className="font-bold text-sm text-gray-800 flex-1">{title}</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${color}18`, color }}>
          {fmt$(total)}
        </span>
      </div>

      {/* Rows */}
      <div className="px-4 flex-1">
        {items.length === 0 && !adding && (
          <p className="text-gray-300 text-xs py-3 text-center">Sin registros</p>
        )}
        {items.map(m => (
          <InlineRow key={m.id} mov={m} disabled={disabled}
            onChange={onChange} onDelete={onDelete} />
        ))}

        {/* Add row inline */}
        {adding && (
          <div className="flex items-center gap-2 py-2 border-t border-dashed border-gray-200 mt-1">
            <input
              ref={descRef}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Descripción…"
              onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd() }}
              className="flex-1 text-sm border-b border-coral outline-none px-1 py-0.5"
              style={{ borderBottomColor: color }}
            />
            <input
              value={monto}
              onChange={e => setMonto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd() }}
              inputMode="decimal"
              placeholder="0"
              className="w-28 text-sm text-right border-b outline-none px-1 py-0.5"
              style={{ borderBottomColor: color }}
            />
            <button onClick={confirmAdd} className="text-green-500 hover:text-green-700 text-xs font-bold">✓</button>
            <button onClick={cancelAdd}  className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
        )}
      </div>

      {/* Footer / add button */}
      {!disabled && (
        <div className="px-4 py-2 border-t border-gray-50">
          <button
            onClick={startAdd}
            className="flex items-center gap-1 text-xs font-semibold transition-colors"
            style={{ color }}
          >
            <Plus size={13} /> Agregar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function CajaDiaria() {
  const [fecha,    setFecha]    = useState(today())
  const [sucursal, setSucursal] = useState<string>('luro')
  const [caja,     setCaja]     = useState<Caja | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  // ── Load caja ────────────────────────────────────────────────
  const loadCaja = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<Caja>(`/caja-diaria/${fecha}/${sucursal}`)
      setCaja(data)
    } finally {
      setLoading(false)
    }
  }, [fecha, sucursal])

  useEffect(() => { loadCaja() }, [loadCaja])

  // ── Patch caja (autosave) ────────────────────────────────────
  async function patchCaja(patch: Record<string, unknown>) {
    if (!caja) return
    const updated = await api.put<Caja>(`/caja-diaria/${caja.id}`, patch)
    setCaja(updated)
  }

  // ── Add movimiento ───────────────────────────────────────────
  async function addMov(tipo: string, descripcion: string, monto: number) {
    if (!caja) return
    const mov = await api.post<Mov>(`/caja-diaria/${caja.id}/movimientos`, { tipo, descripcion, monto })
    // reload para recalcular totales
    const updated = await api.get<Caja>(`/caja-diaria/${fecha}/${sucursal}`)
    setCaja(updated)
  }

  // ── Update movimiento ────────────────────────────────────────
  async function updateMov(id: number, patch: Partial<Mov>) {
    await api.put(`/caja-diaria/movimientos/${id}`, patch)
    const updated = await api.get<Caja>(`/caja-diaria/${fecha}/${sucursal}`)
    setCaja(updated)
  }

  // ── Delete movimiento ────────────────────────────────────────
  async function deleteMov(id: number) {
    await api.delete(`/caja-diaria/movimientos/${id}`)
    const updated = await api.get<Caja>(`/caja-diaria/${fecha}/${sucursal}`)
    setCaja(updated)
  }

  const disabled = !!caja?.cerrada

  const gastos = caja?.movimientos.filter(m => m.tipo === 'gasto')        ?? []
  const transf = caja?.movimientos.filter(m => m.tipo === 'transferencia') ?? []
  const retiros = caja?.movimientos.filter(m => m.tipo === 'retiro')       ?? []

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caja Diaria</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {caja ? fmtDate(caja.fecha) : '—'} · {sucursal === 'luro' ? 'Sucursal Luro' : 'Sucursal Independencia'}
          </p>
        </div>

        {/* Cerrar / Reabrir */}
        {caja && (
          <button
            onClick={() => patchCaja({ cerrada: !caja.cerrada })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={
              caja.cerrada
                ? { background: '#f3f4f6', color: '#6b7280' }
                : { background: NAVY, color: 'white' }
            }
          >
            {caja.cerrada ? <><Unlock size={15} /> Reabrir caja</> : <><Lock size={15} /> Cerrar caja</>}
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        {/* Fecha */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="text-sm font-semibold text-gray-700 outline-none bg-transparent"
          />
        </div>

        {/* Sucursal */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
          {SUCURSALES.map(s => (
            <button
              key={s.key}
              onClick={() => setSucursal(s.key)}
              className="px-4 py-2 text-sm font-semibold transition-all"
              style={
                sucursal === s.key
                  ? { background: NAVY, color: 'white' }
                  : { color: '#9ca3af' }
              }
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Estado */}
        {caja && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
               style={
                 caja.cerrada
                   ? { background: '#fee2e2', color: '#dc2626' }
                   : { background: '#dcfce7', color: '#16a34a' }
               }>
            <div className="w-1.5 h-1.5 rounded-full"
                 style={{ background: caja.cerrada ? '#dc2626' : '#16a34a' }} />
            {caja.cerrada ? 'CERRADA' : 'ABIERTA'}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Cargando…</div>
      )}

      {caja && !loading && (
        <>
          {/* ── 4 sections grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Gastos */}
            <Section
              title="Gastos"
              icon={<ArrowUpCircle size={16} />}
              color="#ef4444"
              total={caja.total_gastos}
              items={gastos}
              tipo="gasto"
              cajaId={caja.id}
              disabled={disabled}
              onAdd={addMov}
              onChange={updateMov}
              onDelete={deleteMov}
            />

            {/* Transferencias */}
            <Section
              title="Transferencias"
              icon={<ArrowDownCircle size={16} />}
              color="#2563eb"
              total={caja.total_transf}
              items={transf}
              tipo="transferencia"
              cajaId={caja.id}
              disabled={disabled}
              onAdd={addMov}
              onChange={updateMov}
              onDelete={deleteMov}
            />

            {/* Retiro de caja */}
            <Section
              title="Retiro de Caja"
              icon={<Banknote size={16} />}
              color="#f59e0b"
              total={caja.total_retiros}
              items={retiros}
              tipo="retiro"
              cajaId={caja.id}
              disabled={disabled}
              onAdd={addMov}
              onChange={updateMov}
              onDelete={deleteMov}
            />

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
                      <input
                        defaultValue={val || ''}
                        disabled={disabled}
                        inputMode="decimal"
                        placeholder="0"
                        onBlur={e => {
                          const n = parseFloat(e.target.value) || 0
                          if (n !== val) patchCaja({ [key]: n })
                        }}
                        className="flex-1 text-sm text-right border-b border-gray-200 focus:border-purple-400 outline-none px-1 py-0.5 bg-transparent disabled:opacity-50"
                      />
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
            <input
              key={caja.id + '-efectivo'}
              defaultValue={caja.efectivo_del_dia || ''}
              disabled={disabled}
              inputMode="decimal"
              placeholder="0,00"
              onBlur={e => {
                const n = parseFloat(e.target.value) || 0
                if (n !== caja.efectivo_del_dia) patchCaja({ efectivo_del_dia: n })
              }}
              className="w-36 text-right text-xl font-bold text-gray-800 border-b-2 focus:outline-none px-2 py-1 bg-transparent disabled:opacity-50"
              style={{ borderBottomColor: CORAL }}
            />
          </div>

          {/* ── Resumen / TOTAL DEL DÍA ── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100"
                 style={{ background: NAVY }}>
              <p className="text-white/60 text-[11px] font-bold tracking-[2px] uppercase">Resumen del día</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100">
              {[
                { label: 'Transferencias',  value: caja.total_transf,    color: '#2563eb' },
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

            {/* TOTAL */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between"
                 style={{ background: '#f8f7f5' }}>
              <p className="font-bold text-gray-600 text-sm uppercase tracking-wide">Total del día</p>
              <p className="text-3xl font-bold" style={{ color: CORAL }}>
                {fmt$(caja.total_del_dia)}
              </p>
            </div>
          </div>

          {/* ── Observaciones ── */}
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Observaciones del día
            </p>
            <textarea
              key={caja.id + '-obs'}
              defaultValue={caja.observaciones}
              disabled={disabled}
              onBlur={e => {
                if (e.target.value !== caja.observaciones)
                  patchCaja({ observaciones: e.target.value })
              }}
              rows={3}
              placeholder="Anotá cualquier novedad del día…"
              className="w-full text-sm text-gray-700 resize-none outline-none bg-transparent placeholder:text-gray-300 disabled:opacity-50"
            />
          </div>
        </>
      )}
    </div>
  )
}
