import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, FileDown } from 'lucide-react'
import clsx from 'clsx'
import { api, fmt$, MONTHS, CURRENT_YEAR } from '../api'

type Tab = 'compartidos' | 'luro'

export default function Gastos() {
  const [tab, setTab]     = useState<Tab>('compartidos')
  const [month, setMonth] = useState('ABRIL')
  const year              = CURRENT_YEAR

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gastos</h1>
          <p className="text-wood-500 text-sm">Compartidos entre sucursales · Gastos Luro</p>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)} className="input w-36 text-sm">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="flex gap-2 border-b border-wood-100 pb-0">
        {(['compartidos','luro'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              tab === t ? 'bg-white border border-b-white border-wood-100 text-wood-900 -mb-px'
                        : 'text-wood-500 hover:text-wood-800')}>
            {t === 'compartidos' ? '💸 Compartidos' : '💰 Gastos Luro'}
          </button>
        ))}
      </div>

      {tab === 'compartidos'
        ? <GastosCompartidos month={month} year={year} />
        : <GastosLuro       month={month} year={year} />}
    </div>
  )
}

function GastosCompartidos({ month, year }: { month: string; year: number }) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [edits, setEdits]       = useState<Record<number, any>>({})

  const load = useCallback(() => {
    api.get<any[]>(`/expenses/shared/${year}/${month}`).then(setExpenses)
  }, [month, year])

  useEffect(() => { load() }, [load])

  const save = async (id: number) => {
    const edit = edits[id]
    if (!edit) return
    await api.put(`/expenses/shared/${id}`, edit)
    load()
    setEdits(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const totalLuro  = expenses.reduce((a, e) => a + (parseFloat(e.luro_amount)  || 0), 0)
  const totalTotal = expenses.reduce((a, e) => a + (parseFloat(e.total_amount) || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <div className="kpi-card py-2 px-3">
            <span className="kpi-label text-[10px]">Total Compartido</span>
            <span className="kpi-value text-base">{fmt$(totalTotal)}</span>
          </div>
          <div className="kpi-card py-2 px-3">
            <span className="kpi-label text-[10px]">Corresponde Luro</span>
            <span className="kpi-value text-base">{fmt$(totalLuro)}</span>
          </div>
        </div>
        <button onClick={() => api.pdf(`/expenses/shared/${year}/${month}/pdf`, `gastos_compartidos_${month}_${year}.pdf`)}
          className="btn-ghost text-sm">
          <FileDown size={15} /> PDF
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[550px]">
            <thead className="bg-wood-50 border-b border-wood-100">
              <tr>
                <th className="table-th">Ítem</th>
                <th className="table-th">Categoría</th>
                <th className="table-th text-right">Total $</th>
                <th className="table-th text-right">Luro $</th>
                <th className="table-th text-center">Pagado</th>
                <th className="table-th" />
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => {
                const edit    = edits[e.id] ?? {}
                const isDirty = !!edits[e.id]
                return (
                  <tr key={e.id} className="table-tr">
                    <td className="table-td text-xs font-medium">{e.item_name}</td>
                    <td className="table-td text-xs text-wood-500">{e.category}</td>
                    <td className="table-td p-1">
                      <input type="number" placeholder="0"
                        className="input py-1 px-2 text-xs text-right w-28"
                        value={edit.total_amount ?? e.total_amount ?? ''}
                        onChange={ev => setEdits(prev => ({ ...prev, [e.id]: { ...prev[e.id], total_amount: ev.target.value || null } }))}
                      />
                    </td>
                    <td className="table-td text-xs text-right">
                      {fmt$((edit.total_amount ?? e.total_amount) / 2)}
                    </td>
                    <td className="table-td text-center p-1">
                      <button
                        onClick={() => setEdits(prev => ({
                          ...prev, [e.id]: { ...prev[e.id], paid_status: e.paid_status === 'SI' ? 'NO' : 'SI' }
                        }))}
                        className={clsx('badge cursor-pointer',
                          (edit.paid_status ?? e.paid_status) === 'SI' ? 'badge-green' : 'badge-red')}>
                        {(edit.paid_status ?? e.paid_status) === 'SI' ? 'SI' : 'NO'}
                      </button>
                    </td>
                    <td className="table-td p-1">
                      {isDirty && (
                        <button onClick={() => save(e.id)} className="btn-primary text-xs py-1 px-2">OK</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-wood-50 border-t-2 border-wood-200">
                <td colSpan={2} className="table-td font-bold text-xs">TOTAL MES</td>
                <td className="table-td text-xs text-right font-bold">{fmt$(totalTotal)}</td>
                <td className="table-td text-xs text-right font-bold">{fmt$(totalLuro)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function GastosLuro({ month, year }: { month: string; year: number }) {
  const [expenses, setExpenses]   = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState({ expense_date: '', category_id: '', subcategory_id: '', detail: '', amount: '', payment_method: '' })

  const mainCats = categories.filter(c => !c.parent_id)
  const subCats  = categories.filter(c => c.parent_id === parseInt(form.category_id))

  const load = useCallback(() => {
    api.get<any[]>(`/expenses/luro?month=${month}&year=${year}`).then(setExpenses)
  }, [month, year])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get<any[]>('/expenses/categories').then(setCategories)
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    await api.post('/expenses/luro', {
      expense_date:   form.expense_date || null,
      category_id:    parseInt(form.category_id),
      subcategory_id: form.subcategory_id ? parseInt(form.subcategory_id) : null,
      detail:         form.detail || null,
      amount:         parseFloat(form.amount),
      payment_method: form.payment_method || null,
      month, year,
    })
    setAdding(false)
    setForm({ expense_date: '', category_id: '', subcategory_id: '', detail: '', amount: '', payment_method: '' })
    load()
  }

  const total = expenses.reduce((a, e) => a + parseFloat(e.amount || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="kpi-card py-2 px-3 inline-flex flex-col">
          <span className="kpi-label text-[10px]">Total Luro</span>
          <span className="kpi-value text-base">{fmt$(total)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => api.pdf(`/expenses/luro/pdf/${year}/${month}`, `gastos_luro_${month}_${year}.pdf`)}
            className="btn-ghost text-sm"><FileDown size={15} /> PDF</button>
          <button onClick={() => setAdding(!adding)} className="btn-primary text-sm">
            <Plus size={15} /> Nuevo
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="card grid grid-cols-2 md:grid-cols-4 gap-3">
          <input type="date" className="input" value={form.expense_date}
            onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
          <select className="input" value={form.category_id} required
            onChange={e => setForm(f => ({ ...f, category_id: e.target.value, subcategory_id: '' }))}>
            <option value="">Categoría *</option>
            {mainCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={form.subcategory_id}
            onChange={e => setForm(f => ({ ...f, subcategory_id: e.target.value }))}>
            <option value="">Subcategoría</option>
            {subCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="text" placeholder="Detalle" className="input" value={form.detail}
            onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} />
          <input type="number" placeholder="Importe $ *" className="input" value={form.amount} required
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} step="0.01" />
          <select className="input" value={form.payment_method}
            onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
            <option value="">Medio de pago</option>
            <option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option>
          </select>
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" className="btn-primary">Guardar</button>
          </div>
        </form>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-wood-50 border-b border-wood-100">
              <tr>
                <th className="table-th">Fecha</th>
                <th className="table-th">Categoría</th>
                <th className="table-th">Subcategoría</th>
                <th className="table-th">Detalle</th>
                <th className="table-th text-right">Importe $</th>
                <th className="table-th">Medio</th>
                <th className="table-th" />
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="table-tr">
                  <td className="table-td text-xs">{e.expense_date ?? '—'}</td>
                  <td className="table-td text-xs">{e.category_name ?? '—'}</td>
                  <td className="table-td text-xs text-wood-500">{e.subcategory_name ?? '—'}</td>
                  <td className="table-td text-xs">{e.detail ?? '—'}</td>
                  <td className="table-td text-xs text-right font-medium">{fmt$(parseFloat(e.amount))}</td>
                  <td className="table-td text-xs text-wood-500">{e.payment_method ?? '—'}</td>
                  <td className="table-td p-1">
                    <button onClick={async () => { await api.delete(`/expenses/luro/${e.id}`); load() }}
                      className="text-red-400 hover:text-red-600 transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan={7} className="table-td text-center text-wood-400 py-10">No hay gastos para {month} {year}</td></tr>
              )}
              <tr className="bg-wood-50 border-t-2 border-wood-200">
                <td colSpan={4} className="table-td font-bold text-xs">TOTAL MES</td>
                <td className="table-td text-xs text-right font-bold">{fmt$(total)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
