import { useEffect, useState, useCallback } from 'react'
import { Save, FileDown, Lock } from 'lucide-react'
import clsx from 'clsx'
import { api, fmt$, MONTHS, CURRENT_YEAR } from '../api'

const BRANCHES = [{ id: 1, name: 'LURO' }, { id: 2, name: 'INDEPENDENCIA' }]

type Sale = {
  id: number; sale_date: string; branch_id: number
  total_amount: number | null; card_payments: number | null
  ticket_count: number | null; avg_ticket: number | null; closed: boolean
}

export default function Ventas() {
  const [month, setMonth]   = useState('ABRIL')
  const [year]              = useState(CURRENT_YEAR)
  const [sales, setSales]   = useState<Sale[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [edits, setEdits]   = useState<Record<string, Partial<Sale>>>({})

  const load = useCallback(() => {
    api.get<Sale[]>(`/sales/?month=${month}&year=${year}`).then(setSales)
    api.get(`/sales/summary/${year}/${month}`).then(setSummary).catch(() => setSummary(null))
  }, [month, year])

  useEffect(() => { load() }, [load])

  const key = (date: string, bid: number) => `${date}_${bid}`

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

  const closeMonth = async () => {
    if (!confirm(`¿Cerrar el mes ${month} ${year}? Esta acción archiva los datos.`)) return
    await api.post(`/sales/close-month/${year}/${month}`, {})
    load()
  }

  const days = Array.from(new Set(sales.map(s => s.sale_date))).sort()

  const getSale = (date: string, bid: number) =>
    sales.find(s => s.sale_date === date && s.branch_id === bid)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ventas Diarias</h1>
          <p className="text-wood-500 text-sm">Registrá las ventas del día en ambas sucursales</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="input w-36 text-sm">
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
          <button onClick={closeMonth} className="btn-ghost text-amber-700">
            <Lock size={15} /> Cerrar Mes
          </button>
        </div>
      </div>

      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Mes', value: fmt$(summary.combined_total) },
            { label: 'Luro',      value: fmt$(summary.luro_total) },
            { label: 'Independ.', value: fmt$(summary.indep_total) },
            { label: 'T. Prom. Luro', value: fmt$(summary.luro_avg_ticket) },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <span className="kpi-label">{k.label}</span>
              <span className="kpi-value text-lg">{k.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[600px]">
          <thead className="bg-wood-50 border-b border-wood-100">
            <tr>
              <th className="table-th">Fecha</th>
              {BRANCHES.map(b => (
                <th key={b.id} className="table-th" colSpan={3}>
                  📍 {b.name}
                </th>
              ))}
            </tr>
            <tr className="bg-wood-50 border-b border-wood-100 text-[10px] text-wood-500">
              <td className="px-3 py-1" />
              {BRANCHES.map(b => (
                <>
                  <td key={`${b.id}-total`}  className="px-3 py-1">Total $</td>
                  <td key={`${b.id}-cards`}  className="px-3 py-1">Tarjetas</td>
                  <td key={`${b.id}-tickets`} className="px-3 py-1">Tickets</td>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(date => (
              <tr key={date} className="table-tr">
                <td className="table-td font-medium text-xs">
                  {new Date(date + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </td>
                {BRANCHES.map(b => {
                  const sale = getSale(date, b.id)
                  const k    = key(date, b.id)
                  const edit = edits[k] ?? {}
                  const isSaving = saving === k
                  const isDirty  = !!edits[k]

                  return (
                    <>
                      {(['total_amount', 'card_payments', 'ticket_count'] as const).map(field => (
                        <td key={`${k}-${field}`} className="table-td p-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className={clsx('input py-1.5 px-2 text-xs w-24',
                                sale?.closed && 'bg-wood-50 cursor-not-allowed opacity-60')}
                              disabled={sale?.closed}
                              placeholder="—"
                              value={edit[field] ?? sale?.[field] ?? ''}
                              onChange={e => handleEdit(date, b.id, field, e.target.value)}
                            />
                          </div>
                        </td>
                      ))}
                      {isDirty && (
                        <td className="table-td p-1">
                          <button
                            onClick={() => handleSave(date, b.id)}
                            disabled={isSaving}
                            className="btn-primary py-1.5 px-2 text-xs"
                          >
                            <Save size={12} />
                          </button>
                        </td>
                      )}
                    </>
                  )
                })}
              </tr>
            ))}
            {days.length === 0 && (
              <tr>
                <td colSpan={7} className="table-td text-center text-wood-400 py-12">
                  No hay datos para {month} {year}. Los días aparecen al guardar la primera venta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
