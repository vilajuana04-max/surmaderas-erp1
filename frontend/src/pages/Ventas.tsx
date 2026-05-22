import React, { useEffect, useState, useCallback } from 'react'
import { FileDown, Lock, ChevronDown, History, X } from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR } from '../api'

const NAVY      = '#070614'
const CORAL     = '#C8603A'
const CORAL_DRK = '#A84E2C'

const BRANCHES = [
  { id: 2, name: 'INDEPENDENCIA', hdrBg: NAVY,  subBg: '#0f0f2e', rowBg: 'bg-teal-50/50'   },
  { id: 1, name: 'LURO',          hdrBg: CORAL, subBg: '#8B3A20', rowBg: 'bg-orange-50/50' },
]

type Sale = {
  id: number; sale_date: string; branch_id: number
  total_amount: number | null; card_payments: number | null
  ticket_count: number | null; avg_ticket: number | null; closed: boolean
}

type MonthHistory = {
  month: string; luro_total: number; indep_total: number
  combined: number; days_with_data: number
}

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

function getWeeks(days: string[]) {
  const weeks: { label: string; days: string[] }[] = []
  for (let i = 0; i < days.length; i += 7)
    weeks.push({ label: `Semana ${weeks.length + 1}`, days: days.slice(i, i + 7) })
  return weeks
}

export default function Ventas() {
  const [month, setMonth]     = useState('MAYO')
  const [year]                = useState(CURRENT_YEAR)
  const [sales, setSales]     = useState<Sale[]>([])
  const [saving, setSaving]   = useState<string | null>(null)
  const [edits, setEdits]     = useState<Record<string, Partial<Sale>>>({})
  const [showPdf, setShowPdf] = useState(false)
  const [branchFilter, setBranchFilter] = useState('AMBAS')
  const [showHistory, setShowHistory]   = useState(false)
  const [history, setHistory]           = useState<MonthHistory[]>([])

  const load = useCallback(() => {
    api.get<Sale[]>(`/sales/?month=${month}&year=${year}`)
      .then(setSales).catch(() => setSales([]))
  }, [month, year])

  useEffect(() => { load() }, [load])

  // Cuando abre historial, carga el resumen anual
  useEffect(() => {
    if (showHistory)
      api.get<MonthHistory[]>(`/sales/history/${year}`)
        .then(setHistory).catch(() => setHistory([]))
  }, [showHistory, year])

  const allDays = getDaysInMonth(month, year)
  const weeks   = getWeeks(allDays)

  const visibleBranches = branchFilter === 'AMBAS'
    ? BRANCHES
    : BRANCHES.filter(b => b.name === branchFilter)

  const k    = (date: string, bid: number) => `${date}_${bid}`
  const find = (date: string, bid: number) =>
    sales.find(s => s.sale_date === date && s.branch_id === bid)

  // Valor efectivo: prioriza edit sobre guardado
  const eff = (date: string, bid: number, field: keyof Sale): number => {
    const kk   = k(date, bid)
    const edit = edits[kk]
    if (edit && field in edit) return Number((edit as Record<string, unknown>)[field] ?? 0)
    return Number(find(date, bid)?.[field] ?? 0)
  }

  // Suma de un campo para una sucursal, en tiempo real
  const sumField = (bid: number, field: keyof Sale) =>
    allDays.reduce((acc, d) => acc + eff(d, bid, field), 0)

  const handleEdit = (date: string, bid: number, field: string, val: string) => {
    const kk = k(date, bid)
    setEdits(prev => ({ ...prev, [kk]: { ...prev[kk], [field]: val === '' ? null : Number(val) } }))
  }

  const handleSave = async (date: string, bid: number) => {
    const kk   = k(date, bid)
    const edit = edits[kk]
    if (!edit) return
    setSaving(kk)
    try {
      await api.post('/sales/', { sale_date: date, branch_id: bid, ...edit, year })
      load()
      setEdits(prev => { const n = { ...prev }; delete n[kk]; return n })
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
      .catch(err => alert(`Error al generar PDF: ${err.message}`))
    setShowPdf(false)
  }

  // Totales en tiempo real
  const luroTotal  = sumField(1, 'total_amount')
  const indepTotal = sumField(2, 'total_amount')
  const luroCards  = sumField(1, 'card_payments')
  const indepCards = sumField(2, 'card_payments')
  const luroTicks  = sumField(1, 'ticket_count')
  const indepTicks = sumField(2, 'ticket_count')

  // Resumen semanal en tiempo real
  const weekSummary = (days: string[]) => {
    const withData = days.filter(d =>
      BRANCHES.some(b => eff(d, b.id, 'total_amount') > 0)
    ).length
    const iT  = days.reduce((a, d) => a + eff(d, 2, 'total_amount'), 0)
    const lT  = days.reduce((a, d) => a + eff(d, 1, 'total_amount'), 0)
    const iTk = days.reduce((a, d) => a + eff(d, 2, 'ticket_count'), 0)
    const lTk = days.reduce((a, d) => a + eff(d, 1, 'ticket_count'), 0)
    return {
      withData,
      iT, iTk, iProm: withData ? iT / withData : 0,
      lT, lTk, lProm: withData ? lT / withData : 0,
    }
  }

  const inputCls = (dirty: boolean, closed: boolean) =>
    `w-full text-right text-xs px-2 py-1.5 rounded border focus:outline-none transition-colors bg-transparent
    ${closed ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white focus:bg-white focus:border-gray-300'}
    ${dirty  ? 'border-amber-300 bg-amber-50'  : 'border-transparent'}`

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <div style={{ background: NAVY }} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase mb-1">Sur Maderas · ERP</p>
          <h1 className="text-2xl font-bold text-white">Ventas Diarias</h1>
          <p className="text-white/50 text-sm">Registrá las ventas del día en ambas sucursales</p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <select value={month} onChange={e => { setMonth(e.target.value); setEdits({}) }}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
            {MONTHS.map(m => <option key={m} className="text-black">{m}</option>)}
          </select>

          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
            {['AMBAS', 'INDEPENDENCIA', 'LURO'].map(b =>
              <option key={b} className="text-black">{b}</option>)}
          </select>

          {/* Historial */}
          <button onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-2 rounded-lg text-sm transition-colors">
            <History size={15} /> Historial
          </button>

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

          <button onClick={closeMonth}
            className="flex items-center gap-2 border border-white/20 text-white/70 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <Lock size={14} /> Cerrar Mes
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Mes',     value: fmt$(luroTotal + indepTotal), accent: NAVY  },
          { label: 'Independencia', value: fmt$(indepTotal),             accent: NAVY  },
          { label: 'Luro',          value: fmt$(luroTotal),              accent: CORAL },
          { label: 'T.Prom Indep.', value: indepTicks ? fmt$(indepTotal / indepTicks) : '—', accent: '#464545' },
        ].map(k => (
          <div key={k.label} style={{ borderTop: `3px solid ${k.accent}` }}
            className="bg-white rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">{k.label}</span>
            <span className="text-xl font-bold text-gray-800">{k.value}</span>
          </div>
        ))}
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
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
                    style={{ background: b.hdrBg }}
                    className="text-white px-3 py-2.5 text-xs font-bold tracking-widest uppercase text-center border-x-2 border-white/20">
                    ↑ {b.name}
                  </th>
                ))}
                <th rowSpan={2} style={{ background: CORAL_DRK }}
                  className="text-white px-3 py-3 text-[10px] font-bold tracking-widest uppercase text-right">
                  TOTAL DÍA
                </th>
              </tr>
              <tr>
                {visibleBranches.map(b =>
                  ['TOTAL $', 'TARJETAS', 'TICKETS', 'T.PROM $'].map(col => (
                    <td key={`${b.id}-${col}`} style={{ background: b.subBg }}
                      className="text-white/60 px-3 py-1.5 text-[10px] font-semibold text-center border-x border-white/10">
                      {col}
                    </td>
                  ))
                )}
              </tr>
            </thead>

            <tbody>
              {allDays.map((date, idx) => {
                const dayLabel = new Date(date + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short' })
                const dayNum   = date.slice(8, 10) + '/' + date.slice(5, 7)
                const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'

                // Total del día en tiempo real (todos los branches visibles)
                const rowTotal = visibleBranches.reduce((acc, b) => acc + eff(date, b.id, 'total_amount'), 0)

                return (
                  <tr key={date} className={rowClass}>
                    <td className="px-3 py-1 text-xs font-semibold text-gray-700 border-b border-gray-100">{dayNum}</td>
                    <td className="px-2 py-1 text-xs text-gray-400 italic border-b border-gray-100">{dayLabel}</td>

                    {visibleBranches.map(b => {
                      const sale    = find(date, b.id)
                      const kk      = k(date, b.id)
                      const edit    = edits[kk] ?? {}
                      const isDirty = !!edits[kk]
                      const isSav   = saving === kk
                      const closed  = sale?.closed ?? false

                      // T.Prom en tiempo real
                      const total   = eff(date, b.id, 'total_amount')
                      const tickets = eff(date, b.id, 'ticket_count')
                      const tProm   = tickets > 0 ? total / tickets : null

                      return (
                        <React.Fragment key={`${kk}-cells`}>
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
                          {/* T.Prom $ + botón guardar */}
                          <td className={`${b.rowBg} border-b border-gray-100 border-r-2 border-r-gray-200 px-2 py-1 text-xs text-right text-gray-500`}>
                            <div className="flex items-center justify-end gap-1">
                              <span>{tProm != null ? fmt$(tProm) : '—'}</span>
                              {isDirty && (
                                <button onClick={() => handleSave(date, b.id)} disabled={isSav}
                                  style={{ background: isSav ? '#aaa' : CORAL }}
                                  className="text-[10px] text-white px-1.5 py-0.5 rounded font-bold">
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
                <td colSpan={2} className="px-3 py-3 text-white text-xs font-bold uppercase tracking-widest">
                  TOTAL MES
                </td>
                {visibleBranches.map(b => {
                  const tot   = b.id === 1 ? luroTotal  : indepTotal
                  const cards = b.id === 1 ? luroCards  : indepCards
                  const ticks = b.id === 1 ? luroTicks  : indepTicks
                  const prom  = ticks > 0 ? tot / ticks : 0
                  return (
                    <React.Fragment key={`tot-${b.id}`}>
                      <td className="px-3 py-3 text-white text-xs font-bold text-right">{fmt$(tot)}</td>
                      <td className="px-3 py-3 text-white text-xs font-bold text-right">{fmt$(cards)}</td>
                      <td className="px-3 py-3 text-white text-xs font-bold text-right">{ticks > 0 ? ticks : '—'}</td>
                      <td className="px-3 py-3 text-white text-xs font-bold text-right">{prom > 0 ? fmt$(prom) : '—'}</td>
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

      {/* REPORTE SEMANAL */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div style={{ background: NAVY }} className="px-5 py-3">
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
                    <td className="px-3 py-2.5 text-right text-gray-400">{ws.iTk > 0 ? ws.iTk : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-700">{ws.lT > 0 ? fmt$(ws.lT) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{ws.lT > 0 ? fmt$(ws.lProm) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{ws.lTk > 0 ? ws.lTk : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-bold" style={{ color: CORAL }}>
                      {(ws.iT + ws.lT) > 0 ? fmt$(ws.iT + ws.lT) : '—'}
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: NAVY }}>
                <td colSpan={2} className="px-4 py-3 text-white font-bold uppercase tracking-widest">Total Mes</td>
                <td className="px-3 py-3 text-white font-bold text-right">{fmt$(indepTotal)}</td>
                <td className="px-3 py-3 text-white/40 text-right">—</td>
                <td className="px-3 py-3 text-white font-bold text-right">{indepTicks > 0 ? indepTicks : '—'}</td>
                <td className="px-3 py-3 text-white font-bold text-right">{fmt$(luroTotal)}</td>
                <td className="px-3 py-3 text-white/40 text-right">—</td>
                <td className="px-3 py-3 text-white font-bold text-right">{luroTicks > 0 ? luroTicks : '—'}</td>
                <td className="px-3 py-3 font-bold text-right" style={{ color: CORAL }}>
                  {fmt$(luroTotal + indepTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL HISTORIAL */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header modal */}
            <div style={{ background: NAVY }} className="px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase">Historial</p>
                <h2 className="text-white font-bold text-lg">Ventas por Mes — {year}</h2>
              </div>
              <button onClick={() => setShowHistory(false)}
                className="text-white/60 hover:text-white transition-colors">
                <X size={22} />
              </button>
            </div>

            {/* Contenido */}
            <div className="overflow-y-auto flex-1">
              {history.length === 0 ? (
                <p className="text-center text-gray-400 py-12">No hay datos registrados para {year}.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-5 py-3 text-left text-gray-500 font-semibold uppercase tracking-wide text-xs">Mes</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: NAVY }}>Independencia</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: CORAL }}>Luro</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700">Total Mes</th>
                      <th className="px-4 py-3 text-center text-xs text-gray-400">Días</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={h.month}
                        onClick={() => { setMonth(h.month); setShowHistory(false) }}
                        className={`cursor-pointer hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-5 py-3 font-semibold text-gray-700">{h.month}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt$(h.indep_total)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt$(h.luro_total)}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: CORAL }}>{fmt$(h.combined)}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{h.days_with_data}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Total anual */}
                  <tfoot>
                    <tr style={{ background: NAVY }}>
                      <td className="px-5 py-3 text-white font-bold uppercase tracking-widest text-xs">TOTAL {year}</td>
                      <td className="px-4 py-3 text-white font-bold text-right text-xs">
                        {fmt$(history.reduce((a, h) => a + h.indep_total, 0))}
                      </td>
                      <td className="px-4 py-3 text-white font-bold text-right text-xs">
                        {fmt$(history.reduce((a, h) => a + h.luro_total, 0))}
                      </td>
                      <td className="px-4 py-3 font-bold text-right text-xs" style={{ color: CORAL }}>
                        {fmt$(history.reduce((a, h) => a + h.combined, 0))}
                      </td>
                      <td className="px-4 py-3 text-white/60 text-center text-xs">
                        {history.reduce((a, h) => a + h.days_with_data, 0)} días
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
              Hacé click en un mes para ir directamente a ese período
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
