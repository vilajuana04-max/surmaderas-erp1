import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, FileDown, Search } from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR } from '../api'

type Purchase = {
  id: number; purchase_date: string | null; invoice_number: string | null
  provider_name: string | null; total_amount: number; flag: string | null
  month_label: string; year: number; closed: boolean
}

const emptyForm = { purchase_date: '', invoice_number: '', provider_name: '', total_amount: '' }

export default function Compras() {
  const [month, setMonth]         = useState('ABRIL')
  const [year]                    = useState(CURRENT_YEAR)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [summary, setSummary]     = useState<any[]>([])
  const [search, setSearch]       = useState('')
  const [form, setForm]           = useState(emptyForm)
  const [adding, setAdding]       = useState(false)
  const [saving, setSaving]       = useState(false)

  const load = useCallback(() => {
    api.get<Purchase[]>(`/purchases/?month=${month}&year=${year}&provider=${search}`)
      .then(setPurchases)
    api.get<any[]>(`/purchases/summary/${year}/${month}`).then(setSummary).catch(() => setSummary([]))
  }, [month, year, search])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.provider_name || !form.total_amount) return
    setSaving(true)
    try {
      await api.post('/purchases/', {
        purchase_date:  form.purchase_date || null,
        invoice_number: form.invoice_number || null,
        provider_name:  form.provider_name.toUpperCase(),
        total_amount:   parseFloat(form.total_amount),
        month_label:    month,
        year,
      })
      setForm(emptyForm)
      setAdding(false)
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta factura?')) return
    await api.delete(`/purchases/${id}`)
    load()
  }

  const totalMes = purchases.reduce((a, p) => a + p.total_amount, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compras y Gastos</h1>
          <p className="text-wood-500 text-sm">Registro de facturas — una por fila</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(e.target.value)} className="input w-36 text-sm">
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
          <button onClick={() => api.pdf(`/purchases/pdf/${year}/${month}`, `compras_${month}_${year}.pdf`)}
            className="btn-ghost">
            <FileDown size={15} /> PDF
          </button>
          <button onClick={() => setAdding(!adding)} className="btn-primary">
            <Plus size={15} /> Nueva
          </button>
        </div>
      </div>

      {/* Formulario */}
      {adding && (
        <form onSubmit={handleAdd} className="card grid grid-cols-2 md:grid-cols-5 gap-3">
          <input type="date"   placeholder="Fecha"      className="input" value={form.purchase_date}
            onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
          <input type="text"   placeholder="Nro Factura" className="input" value={form.invoice_number}
            onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
          <input type="text"   placeholder="Proveedor *" className="input col-span-2 md:col-span-1"
            value={form.provider_name}
            onChange={e => setForm(f => ({ ...f, provider_name: e.target.value }))} required />
          <input type="number" placeholder="Total $ *"   className="input" value={form.total_amount}
            onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} required step="0.01" />
          <div className="col-span-2 md:col-span-5 flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando…' : 'Guardar Factura'}
            </button>
          </div>
        </form>
      )}

      {/* KPIs + Resumen proveedores */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="kpi-card md:col-span-1">
          <span className="kpi-label">Total {month}</span>
          <span className="kpi-value">{fmt$(totalMes)}</span>
          <span className="kpi-sub">{purchases.length} facturas</span>
        </div>
        <div className="card md:col-span-2 p-0 overflow-hidden">
          <p className="px-4 pt-3 text-xs font-semibold text-wood-600 uppercase tracking-wide">
            Resumen por proveedor
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                {summary.slice(0, 6).map((s: any) => (
                  <tr key={s.provider_name} className="table-tr">
                    <td className="table-td text-xs">{s.provider_name}</td>
                    <td className="table-td text-xs text-right">{fmt$(s.total)}</td>
                    <td className="table-td text-xs text-right text-wood-500">{s.percentage}%</td>
                    <td className="table-td text-xs text-right text-wood-400">{s.count} fact.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Buscador + Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-wood-100 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wood-400" />
            <input className="input pl-8 text-sm" placeholder="Buscar proveedor…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-wood-50 border-b border-wood-100">
              <tr>
                <th className="table-th">Fecha</th>
                <th className="table-th">Nro Factura</th>
                <th className="table-th">Proveedor</th>
                <th className="table-th text-right">Total $</th>
                <th className="table-th">Flag</th>
                <th className="table-th" />
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} className="table-tr">
                  <td className="table-td text-xs">{p.purchase_date ?? '—'}</td>
                  <td className="table-td text-xs">{p.invoice_number ?? '—'}</td>
                  <td className="table-td text-xs font-medium">{p.provider_name ?? '—'}</td>
                  <td className={`table-td text-xs text-right font-medium ${p.total_amount < 0 ? 'text-red-600' : ''}`}>
                    {fmt$(p.total_amount)}
                  </td>
                  <td className="table-td text-xs">
                    {p.flag === 'NC' && <span className="badge-red">N/C</span>}
                    {p.flag === 'SIN_FECHA' && <span className="badge-amber">Sin fecha</span>}
                  </td>
                  <td className="table-td">
                    {!p.closed && (
                      <button onClick={() => handleDelete(p.id)}
                        className="text-red-400 hover:text-red-600 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-td text-center text-wood-400 py-12">
                    No hay facturas para {month} {year}
                  </td>
                </tr>
              )}
              <tr className="bg-wood-50">
                <td colSpan={3} className="table-td font-bold text-xs">TOTAL MES</td>
                <td className="table-td font-bold text-xs text-right">{fmt$(totalMes)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
