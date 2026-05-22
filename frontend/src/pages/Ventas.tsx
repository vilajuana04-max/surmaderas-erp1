import { useEffect, useState, useCallback } from 'react'
import { FileDown, Lock, ChevronDown } from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR } from '../api'

// ── Brand colors from manual de identidad ──
const NAVY  = '#070614'
const CORAL = '#C8603A'
const CORAL_DARK = '#A84E2C'

const BRANCHES = [
  { id: 2, name: 'INDEPENDENCIA', headerBg: NAVY,  subBg: '#0f0f2e', rowBg: 'bg-teal-50/50'   },
  { id: 1, name: 'LURO',          headerBg: CORAL, subBg: '#8B3A20', rowBg: 'bg-orange-50/50' },
]

type Sale = {
  id: number; sale_date: string; branch_id: number
  total_amount: number | null; card_payments: number | null
  ticket_count: number | null; avg_ticket: number | null; closed: boolean
}

// Genera todos los días del mes como strings "YYYY-MM-DD"
function getDaysInMonth(monthName: string, year: number): string[] {
  const idx = MONTHS.indexOf(monthName)
  if (idx === -1) return []
  const count = new Date(year, idx + 1, 0).getDate()
  return Array.from({ length: count }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    const m = String(idx + 1).padStart(2, '0')
    return `${year}-${m}-${d}`
  })
}

// Agrupa días en semanas (7 por semana)
function getWeeks(days: string[]) {
  const weeks: { label: string; days: string[] }[] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push({ label: `Semana ${weeks.length + 1}`, days: days.slice(i, i + 7) })
  }
  return weeks
}

export default function Ventas() {
  const [month, setMonth]       = useState('MAYO')
  const [year]                  = useState(CURRENT_YEAR)
  const [sales, setSales]       = useState<Sale[]>([])
  const [saving, setSaving]     = useState<string | null>(null)
  const [edits, setEdits]       = useState<Record<string, Partial<Sale>>>({})
  const [showPdf, setShowPdf]   = useState(false)
  const [branchFilter, setBranchFilter] = useState('AMBAS')

  const load = useCallback(() => {
    api.get<Sale[]>(`/sales/?month=${month}&year=${year}`).then(setSales).catch(() => setSales([]))
  }, [month, year])

  useEffect(() => { load() }, [load])

  const allDays = getDaysInMonth(month, year)
  const weeks   = getWeeks(allDays)

  const visibleBranches = branchFilter === 'AMBAS'
    ? BRANCHES
    : BRANCHES.filter(b => b.name === branchFilter)

  const key  = (date: string, bid: number) => `${date}_${bid}`
  const find = (date: string, bid: number) => sales.find(s => s.sale_date === date && s.branch_id === bid)

  const handleEdit = (date: string, bid: number, field: string, val: string) => {
    const k = key(date, bid)
    setEdits(prev => ({ ...prev, [k]: { ...prev[k], [field]: val === '' ? null : Number(val) } }))
  }

  const handleSave = async (date: string, bid: number) => {
    const k    = key(date, bid)
    const edit = edits[k]
    if (!edit) return
    setSaving(k)
    try {
      await api.post('/sales/', { sale_date: date, branch_id: bid, ...edit, year })
      load()
      setEdits(prev => { const n = { ...prev }; delete n[k]; return n })
    } finally { setSaving(null) }
  }

  const handleKey = (e: React.KeyboardEvent, date: string, bid: number) => {
    if (e.key === 'Enter') handleSave(date, bid)
  }

  const closeMonth = async () => {
    if (!confirm(`¿Cerrar ${month} ${year}? Los datos quedarán bloqueados.`)) return
    await api.post(`/sales/close-month/${year}/${month}`, {})
    load()
  }

  const exportPdf = (branch: string) => {
    api.pdf(`/sales/pdf/${year}/${month}?branch=${branch}`, `ventas-${month}-${year}-${branch}.pdf`)
    setShowPdf(false)
  }

  // ── Totales generales ──
  const sumBranch = (bid: number, field: keyof Sale) =>
    sales.filter(s => s.branch_id === bid).reduce((acc, s) => acc + (Number(s[field]) || 0), 0)

  const luroTotal   = sumBranch(1, 'total_amount')
  const indepTotal  = sumBranch(2, 'total_amount')
  const luroCards   = sumBranch(1, 'card_payments')
  const indepCards  = sumBranch(2, 'card_payments')
  const luroTicks   = sumBranch(1, 'ticket_count')
  const indepTicks  = sumBranch(2, 'ticket_count')

  const weekSummary = (days: string[]) => {
    const daySales = sales.filter(s => days.includes(s.sale_date))
    const luro  = daySales.filter(s => s.branch_id === 1)
    const indep = daySales.filter(s => s.branch_id === 2)
    const lT = luro.reduce((a, x) => a + (Number(x.total_amount) || 0), 0)
    const iT = indep.reduce((a, x) => a + (Number(x.total_amount) || 0), 0)
    const lTk = luro.reduce((a, x) => a + (Number(x.ticket_count) || 0), 0)
    const iTk = indep.reduce((a, x) => a + (Number(x.ticket_count) || 0), 0)
    const withData = new Set(daySales.map(s => s.sale_date)).size
    return { withData, iT, iTk, iProm: withData ? iT / withData : 0, lT, lTk, lProm: withData ? lT / withData : 0 }
  }

  const inputCls = (dirty: boolean, closed: boolean) =>
    `w-full text-right text-xs px-2 py-1.5 rounded border focus:outline-none transition-colors bg-transparent
    ${closed       ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white focus:bg-white focus:border-gray-300'}
    ${dirty        ? 'border-amber-300 bg-amber-50'  : 'border-transparent'}`

  return (
    <div className="space-y-5">

      {/* ── HEADER ───────────────────────────────────────────── */}
      <div style={{ background: NAVY }} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase mb-1">Sur Maderas · ERP</p>
          <h1 className="text-2xl font-bold text-white">Ventas Diarias</h1>
          <p className="text-white/50 text-sm">Registrá las ventas del día en ambas sucursales</p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* MES */}
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
            {MONTHS.map(m => <option key={m} className="text-black">{m}</option>)}
          </select>

          {/* SUCURSAL filtro */}
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
            {['AMBAS', 'INDEPENDENCIA', 'LURO'].map(b => (
              <option key={b} className="text-black">{b}</option>
            ))}
          </select>

          {/* PDF */}
          <div className="relative">
            <button onClick={() => setShowPdf(!showPdf)}
              style={{ background: CORAL }}
              className="flex items-center gap-2 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-opacity">
              <FileDown size={15} /> Exportar PDF <ChevronDown size={14} />
            </button>
            {showPdf && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 min-w-52">
                <button onClick={() => exportPdf('all')}
                  className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-t-xl font-medium border-b">
                  📊 Ambas Sucursales
                </button>
                <button onClick={() => exportPdf('independencia')}
                  className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b">
                  🔵 Solo INDEPENDENCIA
                </button>
                <button onClick={() => exportPdf('luro')}
                  className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-50 rounded-b-xl">
                  🟠 Solo LURO
                </button>
              </div>
            )}
          </div>

          {/* Cerrar mes */}
          <button onClick={closeMonth}
            className="flex items-center gap-2 border border-white/20 text-white/70 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <Lock size={14} /> Cerrar Mes
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Mes',      value: fmt$(luroTotal + indepTotal), accent: NAVY  },
          { label: 'Independencia',  value: fmt$(indepTotal),             accent: NAVY  },
          { label: 'Luro',           value: fmt$(luroTotal),              accent: CORAL },
          { label: 'T.Prom Indep.',  value: indepTicks ? fmt$(indepTotal / indepTicks) : '—', accent: '#464545' },
        ].map(k => (
          <div key={k.label} style={{ borderTop: `3px solid ${k.accent}` }}
            className="bg-white rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">{k.label}</span>
            <span className="text-xl font-bold text-gray-800">{k.value}</span>
          </div>
        ))}
      </div>

      {/* ── TABLA PRINCIPAL ──────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              {/* Fila 1: sucursales */}
              <tr>
                <th rowSpan={2} style={{ background: NAVY }}
                  className="text-white/70 px-3 py-3 text-left text-[10px] font-semibold tracking-widest uppercase w-20">
                  FECHA
                </th>
                <th rowSpan={2} style={{ background: NAVY }}
                  className="text-white/70 px-2 py-3 text-left text-[10px] font-semibold w-12">
                  DÍA
                </th>
                {visibleBranches.map(b => (
                  <th key={b.id} colSpan={4}
                    style={{ background: b.headerBg }}
                    className="text-white px-3 py-2.5 text-xs font-bold tracking-widest uppercase text-center border-x-2 border-white/20">
                    ↑ {b.name}
                  </th>
                ))}
                <th rowSpan={2} style={{ background: CORAL_DARK }}
                  className="text-white px-3 py-3 text-[10px] font-bold tracking-widest uppercase text-right">
                  TOTAL DÍA
                </th>
              </tr>

              {/* Fila 2: sub-columnas */}
              <tr>
                {visibleBranches.map(b => (
                  ['TOTAL $', 'TARJETAS', 'TICKETS', 'T.PROM $'].map(col => (
                    <td key={`${b.id}-${col}`}
                      style={{ background: b.subBg }}
                      className="text-white/60 px-3 py-1.5 text-[10px] font-semibold text-center border-x border-white/10">
                      {col}
                    </td>
                  ))
                ))}
              </tr>
            </thead>

            <tbody>
              {allDays.map((date, idx) => {
                const dayLabel = new Date(date + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short' })
                const dayNum   = date.slice(8, 10) + '/' + date.slice(5, 7)
                const isEven   = idx % 2 === 0
                const rowClass = isEven ? 'bg-white' : 'bg-gray-50/80'

                let rowTotal = 0
                visibleBranches.forEach(b => {
                  const s = find(date, b.id)
                  rowTotal += Number(s?.total_amount || 0)
                })

                return (
                  <tr key={date} className={rowClass}>
                    <td className="px-3 py-1 text-xs font-semibold text-gray-700 border-b border-gray-100">{dayNum}</td>
                    <td className="px-2 py-1 text-xs text-gray-400 italic border-b border-gray-100">{dayLabel}</td>

                    {visibleBranches.map(b => {
                      const sale    = find(date, b.id)
                      const k       = key(date, b.id)
                      const edit    = edits[k] ?? {}
                      const isDirty = !!edits[k]
                      const isSav   = saving === k
                      const closed  = sale?.closed ?? false

                      const total   = Number(edit.total_amount   ?? sale?.total_amount   ?? 0)
                      const tickets = Number(edit.ticket_count   ?? sale?.ticket_count   ?? 0)
                      const tProm   = tickets > 0 ? Math.round(total / tickets) : null

                      return (
                        <React.Fragment key={`${k}-cells`}>
                          {/* Total $ */}
                          <td className={`${b.rowBg} border-b border-gray-100 border-l-2 border-l-gray-200 p-0.5`}>
                            <input type="number" placeholder="—"
                              className={inputCls(isDirty, closed)}
                              disabled={closed}
                              value={edit.total_amount ?? sale?.total_amount ?? ''}
                              onChange={e => handleEdit(date, b.id, 'total_amount', e.target.value)}
                              onKeyDown={e => handleKey(e, date, b.id)}
                            />
                          </td>

                          {/* Tarjetas */}
                          <td className={`${b.rowBg} border-b border-gray-100 p-0.5`}>
                            <input type="number" placeholder="—"
                              className={inputCls(isDirty, closed)}
                              disabled={closed}
                              value={edit.card_payments ?? sale?.card_payments ?? ''}
                              onChange={e => handleEdit(date, b.id, 'card_payments', e.target.value)}
                              onKeyDown={e => handleKey(e, date, b.id)}
                            />
                          </td>

                          {/* Tickets */}
                          <td className={`${b.rowBg} border-b border-gray-100 p-0.5`}>
                            <input type="number" placeholder="—"
                              className={inputCls(isDirty, closed)}
                              disabled={closed}
                              value={edit.ticket_count ?? sale?.ticket_count ?? ''}
                              onChange={e => handleEdit(date, b.id, 'ticket_count', e.target.value)}
                              onKeyDown={e => handleKey(e, date, b.id)}
                            />
                          </td>

                          {/* T.Prom $ — calculado, + botón guardar */}
                          <td className={`${b.rowBg} border-b border-gray-100 border-r-2 border-r-gray-200 px-2 py-1 text-xs text-right text-gray-500`}>
                            <div className="flex items-center justify-end gap-1">
                              <span>{tProm ? `$ ${tProm.toLocaleString('es-AR')}` : '—'}</span>
                              {isDirty && (
                                <button onClick={() => handleSave(date, b.id)} disabled={isSav}
                                  style={{ background: isSav ? '#aaa' : CORAL }}
                                  className="text-[10px] text-white px-1.5 py-0.5 rounded font-bold transition-colors">
                                  {isSav ? '…' : '✓'}
                                </button>
                              )}
                            </div>
                          </td>
                        </React.Fragment>
                      )
                    })}

                    {/* Total Día */}
                    <td className="px-3 py-1 text-xs font-bold text-right text-gray-700 border-b border-gray-100">
                      {rowTotal > 0 ? fmt$(rowTotal) : '—'}
                    </td>
                  </tr>
                )
              })}

              {/* TOTAL MES */}
              <tr style={{ background: NAVY }}>
                <td colSpan={2} className="px-3 py-3 text-white text-xs font-bold uppercase tracking-widest">TOTAL MES</td>
                {visibleBranches.map(b => {
                  const tot   = b.id === 1 ? luroTotal  : indepTotal
                  const cards = b.id === 1 ? luroCards  : indepCards
                  const ticks = b.id === 1 ? luroTicks  : indepTicks
                  const prom  = ticks > 0 ? tot / ticks : 0
                  return (
                    <React.Fragment key={`total-${b.id}`}>
                      <td className="px-3 py-3 text-white text-xs font-bold text-right">{fmt$(tot)}</td>
                      <td className="px-3 py-3 text-white text-xs font-bold text-right">{fmt$(cards)}</td>
                      <td className="px-3 py-3 text-white text-xs font-bold text-right">{ticks || '—'}</td>
                      <td className="px-3 py-3 text-white text-xs font-bold text-right">{prom ? fmt$(prom) : '—'}</td>
                    </React.Fragment>
                  )
                })}
                <td className="px-3 py-3 text-xs font-bold text-right" style={{ color: CORAL }}>
                  {fmt$(luroTotal + indepTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── REPORTE SEMANAL ──────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div style={{ background: NAVY }} className="px-5 py-3 flex items-center gap-3">
          <h2 className="text-white font-bold text-sm tracking-widest uppercase">
            Reporte Semanal Comparativo
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-gray-500 font-semibold uppercase tracking-wide">Semana</th>
                <th className="px-3 py-2.5 text-center text-gray-400">Días c/datos</th>
                <th className="px-3 py-2.5 text-right font-semibold" style={{ color: NAVY }}>Indep Total</th>
                <th className="px-3 py-2.5 text-right text-gray-400">Indep Prom/día</th>
                <th className="px-3 py-2.5 text-right text-gray-400">Indep Tickets</th>
                <th className="px-3 py-2.5 text-right font-semibold" style={{ color: CORAL }}>Luro Total</th>
                <th className="px-3 py-2.5 text-right text-gray-400">Luro Prom/día</th>
                <th className="px-3 py-2.5 text-right text-gray-400">Luro Tickets</th>
                <th className="px-3 py-2.5 text-right font-bold text-gray-700">Total Semanal</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => {
                const ws = weekSummary(w.days)
                return (
                  <tr key={w.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2.5 font-semibold text-gray-700">{w.label}</td>
                    <td className="px-3 py-2.5 text-center text-gray-400">{ws.withData || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-700">{ws.iT > 0 ? fmt$(ws.iT) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{ws.iT > 0 ? fmt$(ws.iProm) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{ws.iTk || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-700">{ws.lT > 0 ? fmt$(ws.lT) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{ws.lT > 0 ? fmt$(ws.lProm) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{ws.lTk || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-bold" style={{ color: CORAL }}>
                      {(ws.iT + ws.lT) > 0 ? fmt$(ws.iT + ws.lT) : '—'}
                    </td>
                  </tr>
                )
              })}

              {/* TOTAL MES */}
              <tr style={{ background: NAVY }}>
                <td colSpan={2} className="px-4 py-3 text-white font-bold uppercase tracking-widest">Total Mes</td>
                <td className="px-3 py-3 text-white font-bold text-right">{fmt$(indepTotal)}</td>
                <td className="px-3 py-3 text-white/40 text-right">—</td>
                <td className="px-3 py-3 text-white font-bold text-right">{indepTicks || '—'}</td>
                <td className="px-3 py-3 text-white font-bold text-right">{fmt$(luroTotal)}</td>
                <td className="px-3 py-3 text-white/40 text-right">—</td>
                <td className="px-3 py-3 text-white font-bold text-right">{luroTicks || '—'}</td>
                <td className="px-3 py-3 font-bold text-right" style={{ color: CORAL }}>
                  {fmt$(luroTotal + indepTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

// Importar React para React.Fragment con key
import React from 'react'
