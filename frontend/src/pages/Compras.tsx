import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Trash2, FileDown, Search, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR, CURRENT_MONTH_IDX } from '../api'

const NAVY      = '#070614'
const CORAL     = '#C8603A'
const ALL_YEARS = [2024, 2025, 2026, 2027]

type Purchase = {
  id: number; purchase_date: string | null; invoice_number: string | null
  provider_name: string | null; total_amount: number; flag: string | null
  month_label: string; year: number; closed: boolean
}

const emptyForm = { purchase_date: '', invoice_number: '', provider_name: '', total_amount: '' }

export default function Compras() {
  const [year, setYear]   = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(MONTHS[CURRENT_MONTH_IDX])

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [providers, setProviders] = useState<string[]>([])
  const [summary, setSummary]     = useState<any[]>([])
  const [form, setForm]           = useState(emptyForm)
  const [adding, setAdding]       = useState(false)
  const [saving, setSaving]       = useState(false)

  // Filtros
  const [filterProvider, setFilterProvider] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')
  const [filterMinAmt,   setFilterMinAmt]   = useState('')
  const [filterMaxAmt,   setFilterMaxAmt]   = useState('')
  const [showFilters,    setShowFilters]     = useState(false)
  const [sortField, setSortField] = useState<'date'|'amount'|'provider'>('date')
  const [sortAsc, setSortAsc]     = useState(false)

  // ARCA
  const [arcaAmount, setArcaAmount]   = useState<number>(0)
  const [arcaInput,  setArcaInput]    = useState('')
  const [arcaSaving, setArcaSaving]   = useState(false)
  const [showArca,   setShowArca]     = useState(false)

  const load = useCallback(() => {
    api.get<Purchase[]>(`/purchases/?month=${month}&year=${year}`)
      .then(setPurchases).catch(() => setPurchases([]))
    api.get<any[]>(`/purchases/summary/${year}/${month}`)
      .then(setSummary).catch(() => setSummary([]))
    api.get<{amount: number}>(`/purchases/arca/${year}/${month}`)
      .then(r => { setArcaAmount(r.amount); setArcaInput(r.amount > 0 ? String(r.amount) : '') })
      .catch(() => setArcaAmount(0))
    api.get<any[]>('/purchases/providers')
      .then(ps => setProviders(ps.map((p: any) => p.name))).catch(() => {})
  }, [month, year])

  useEffect(() => { load() }, [load])

  // Filtrado + ordenamiento en frontend
  const filtered = useMemo(() => {
    let list = [...purchases]
    if (filterProvider) list = list.filter(p =>
      p.provider_name?.toLowerCase().includes(filterProvider.toLowerCase()))
    if (filterDateFrom) list = list.filter(p => p.purchase_date && p.purchase_date >= filterDateFrom)
    if (filterDateTo)   list = list.filter(p => p.purchase_date && p.purchase_date <= filterDateTo)
    if (filterMinAmt)   list = list.filter(p => p.total_amount >= Number(filterMinAmt))
    if (filterMaxAmt)   list = list.filter(p => p.total_amount <= Number(filterMaxAmt))

    list.sort((a, b) => {
      let va: any, vb: any
      if (sortField === 'date')     { va = a.purchase_date ?? ''; vb = b.purchase_date ?? '' }
      if (sortField === 'amount')   { va = a.total_amount;         vb = b.total_amount }
      if (sortField === 'provider') { va = a.provider_name ?? '';  vb = b.provider_name ?? '' }
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })
    return list
  }, [purchases, filterProvider, filterDateFrom, filterDateTo, filterMinAmt, filterMaxAmt, sortField, sortAsc])

  const totalMes      = purchases.reduce((a, p) => a + p.total_amount, 0)
  const totalFiltered = filtered.reduce((a, p) => a + p.total_amount, 0)
  const isClosed      = purchases.length > 0 && purchases.every(p => p.closed)
  const hasFilters    = !!(filterProvider || filterDateFrom || filterDateTo || filterMinAmt || filterMaxAmt)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.provider_name || !form.total_amount) return
    setSaving(true)
    try {
      await api.post('/purchases/', {
        purchase_date:  form.purchase_date  || null,
        invoice_number: form.invoice_number || null,
        provider_name:  form.provider_name.toUpperCase(),
        total_amount:   parseFloat(form.total_amount),
        month_label: month, year,
      })
      setForm(emptyForm); setAdding(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta factura?')) return
    await api.delete(`/purchases/${id}`); load()
  }

  const handleCloseMonth = async () => {
    if (!confirm(`¿Cerrar ${month} ${year}? Las facturas quedarán bloqueadas.`)) return
    await api.post(`/purchases/close-month/${year}/${month}`, {}); load()
  }

  const handleSaveArca = async () => {
    const amt = parseFloat(arcaInput)
    if (isNaN(amt)) return
    setArcaSaving(true)
    try {
      await api.post(`/purchases/arca/${year}/${month}`, amt)
      setArcaAmount(amt)
    } finally { setArcaSaving(false) }
  }

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field
      ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
      : null

  // ARCA stats
  const arcaBalance  = arcaAmount - totalMes
  const arcaPct      = arcaAmount > 0 ? Math.round(totalMes / arcaAmount * 100) : null

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <div style={{ background: NAVY }} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase mb-1">Sur Maderas · ERP</p>
          <h1 className="text-2xl font-bold text-white">Compras y Gastos</h1>
          <p className="text-white/50 text-sm">Registro de facturas — una por fila</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
            {ALL_YEARS.map(y => <option key={y} className="text-black">{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
            {MONTHS.map(m => <option key={m} className="text-black">{m}</option>)}
          </select>
          <button onClick={() => api.pdf(`/purchases/pdf/${year}/${month}`, `compras_${month}_${year}.pdf`)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-2 rounded-lg text-sm">
            <FileDown size={15} /> PDF
          </button>
          {!isClosed && (
            <button onClick={handleCloseMonth}
              className="flex items-center gap-2 border border-white/20 text-white/70 hover:text-white px-3 py-2 rounded-lg text-sm">
              <Lock size={14} /> Cerrar Mes
            </button>
          )}
          <button onClick={() => setAdding(!adding)}
            style={{ background: CORAL }}
            className="flex items-center gap-2 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <Plus size={15} /> Nueva Factura
          </button>
        </div>
      </div>

      {isClosed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <Lock size={16} className="text-amber-500" />
          <p className="text-amber-800 text-sm font-semibold">Mes cerrado — las facturas están bloqueadas</p>
        </div>
      )}

      {/* FORMULARIO NUEVA FACTURA */}
      {adding && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <input type="date" placeholder="Fecha" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
          <input type="text" placeholder="Nro Factura" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
          <input type="text" placeholder="Proveedor *" required
            list="providers-list"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 col-span-2 md:col-span-1"
            value={form.provider_name} onChange={e => setForm(f => ({ ...f, provider_name: e.target.value }))} />
          <datalist id="providers-list">
            {providers.map(p => <option key={p} value={p} />)}
          </datalist>
          <input type="number" placeholder="Total $ *" required step="0.01"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
          <div className="col-span-2 md:col-span-5 flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ background: CORAL }}
              className="text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
              {saving ? 'Guardando…' : 'Guardar Factura'}
            </button>
          </div>
        </form>
      )}

      {/* KPIs + RESUMEN PROVEEDORES */}
      <div className="grid md:grid-cols-3 gap-4">
        <div style={{ borderTop: `3px solid ${NAVY}` }} className="bg-white rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">Total {month}</span>
          <span className="text-2xl font-bold text-gray-800 block">{fmt$(totalMes)}</span>
          <span className="text-xs text-gray-400 mt-1 block">{purchases.length} facturas</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-0 overflow-hidden md:col-span-2">
          <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: NAVY }}>
            Top Proveedores — {month}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                {summary.slice(0, 5).map((s: any) => (
                  <tr key={s.provider_name} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-700">{s.provider_name}</td>
                    <td className="px-3 py-2 text-right text-gray-700 font-semibold">{fmt$(s.total)}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{s.percentage}%</td>
                    <td className="px-3 py-2 text-right text-gray-400">{s.count} fact.</td>
                  </tr>
                ))}
                {summary.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-4 text-gray-400 text-center">Sin datos para {month}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          {/* Buscador rápido */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              placeholder="Buscar proveedor…"
              value={filterProvider} onChange={e => setFilterProvider(e.target.value)} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm transition-colors
              ${showFilters || hasFilters ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Filtros {hasFilters && <span className="bg-amber-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">✓</span>}
          </button>
          {hasFilters && (
            <button onClick={() => { setFilterProvider(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterMinAmt(''); setFilterMaxAmt('') }}
              className="text-xs text-red-500 hover:underline">
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Panel de filtros avanzados */}
        {showFilters && (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Fecha desde</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Fecha hasta</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Monto mínimo $</label>
              <input type="number" placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                value={filterMinAmt} onChange={e => setFilterMinAmt(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Monto máximo $</label>
              <input type="number" placeholder="∞" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                value={filterMaxAmt} onChange={e => setFilterMaxAmt(e.target.value)} />
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead style={{ background: NAVY }}>
              <tr>
                <th className="px-4 py-2.5 text-left text-white text-xs font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('date')}>
                  <span className="flex items-center gap-1">Fecha <SortIcon field="date" /></span>
                </th>
                <th className="px-3 py-2.5 text-left text-white text-xs font-semibold">Nro Factura</th>
                <th className="px-3 py-2.5 text-left text-white text-xs font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('provider')}>
                  <span className="flex items-center gap-1">Proveedor <SortIcon field="provider" /></span>
                </th>
                <th className="px-3 py-2.5 text-right text-white text-xs font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('amount')}>
                  <span className="flex items-center gap-1 justify-end">Total $ <SortIcon field="amount" /></span>
                </th>
                <th className="px-3 py-2.5 text-left text-white text-xs font-semibold">Estado</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'}>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {p.purchase_date ?? <span className="text-amber-500">Sin fecha</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{p.invoice_number ?? '—'}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-700">{p.provider_name ?? '—'}</td>
                  <td className={`px-3 py-2 text-xs text-right font-semibold ${p.total_amount < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {fmt$(p.total_amount)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.flag === 'NC' && <span className="bg-red-100 text-red-700 rounded px-1.5 py-0.5 text-[10px] font-bold">N/C</span>}
                    {p.flag === 'SIN_FECHA' && <span className="bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 text-[10px]">Sin fecha</span>}
                    {p.closed && <span className="bg-gray-100 text-gray-400 rounded px-1.5 py-0.5 text-[10px]">Cerrado</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {!p.closed && (
                      <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    {hasFilters ? 'No hay facturas que coincidan con los filtros' : `No hay facturas para ${month} ${year}`}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: NAVY }}>
                <td colSpan={3} className="px-4 py-3 text-white text-xs font-bold uppercase tracking-widest">
                  {hasFilters ? `Filtrado (${filtered.length} de ${purchases.length})` : `TOTAL MES · ${purchases.length} facturas`}
                </td>
                <td className="px-3 py-3 text-right font-bold text-xs" style={{ color: hasFilters && filtered.length < purchases.length ? '#fbbf24' : CORAL === '#C8603A' ? CORAL : CORAL }}>
                  {fmt$(hasFilters ? totalFiltered : totalMes)}
                  {hasFilters && totalFiltered !== totalMes && (
                    <span className="block text-white/50 font-normal">Total mes: {fmt$(totalMes)}</span>
                  )}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* SECCIÓN ARCA */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <button onClick={() => setShowArca(!showArca)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ background: CORAL }}>A</div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Comparativa ARCA vs Compras</p>
              <p className="text-xs text-gray-400">Ingresá la facturación ARCA del mes para comparar con el total de compras</p>
            </div>
          </div>
          {showArca ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {showArca && (
          <div className="border-t border-gray-100 p-5 space-y-4">
            {/* Input ARCA */}
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-48">
                <label className="text-xs text-gray-500 font-semibold block mb-1.5 uppercase tracking-wide">
                  Facturación ARCA {month} {year}
                </label>
                <input type="number" placeholder="$ 0,00" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                  value={arcaInput} onChange={e => setArcaInput(e.target.value)} />
              </div>
              <button onClick={handleSaveArca} disabled={arcaSaving}
                style={{ background: CORAL }}
                className="text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 mb-0">
                {arcaSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>

            {/* Comparativa */}
            {arcaAmount > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div style={{ borderTop: `3px solid ${NAVY}` }} className="bg-gray-50 rounded-xl p-4">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold block mb-1">Ventas ARCA</span>
                  <span className="text-lg font-bold text-gray-800">{fmt$(arcaAmount)}</span>
                </div>
                <div style={{ borderTop: `3px solid ${CORAL}` }} className="bg-gray-50 rounded-xl p-4">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold block mb-1">Total Compras</span>
                  <span className="text-lg font-bold text-gray-800">{fmt$(totalMes)}</span>
                </div>
                <div style={{ borderTop: `3px solid ${arcaBalance >= 0 ? '#16a34a' : '#dc2626'}` }}
                  className="bg-gray-50 rounded-xl p-4">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold block mb-1">Saldo</span>
                  <span className={`text-lg font-bold ${arcaBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {arcaBalance >= 0 ? '+' : ''}{fmt$(arcaBalance)}
                  </span>
                  {arcaPct != null && (
                    <span className="text-xs text-gray-400 block mt-0.5">
                      Compras = {arcaPct}% de ventas
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
