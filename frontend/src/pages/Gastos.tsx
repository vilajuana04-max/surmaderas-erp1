import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Trash2, FileDown } from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR } from '../api'

type Tab = 'compartidos' | 'luro'

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt0(v: any): string {
  const n = parseFloat(v)
  return isNaN(n) ? '' : String(n)
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Gastos() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const tabParam  = (new URLSearchParams(location.search).get('tab') ?? 'compartidos') as Tab

  const [month, setMonth] = useState('MAYO')
  const year = CURRENT_YEAR

  const setTab = (t: Tab) => navigate(`/gastos?tab=${t}`, { replace: true })

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
        {(['compartidos', 'luro'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              tabParam === t
                ? 'bg-white border border-b-white border-wood-100 text-wood-900 -mb-px'
                : 'text-wood-500 hover:text-wood-800',
            ].join(' ')}>
            {t === 'compartidos' ? 'Compartidos' : 'Gastos Luro'}
          </button>
        ))}
      </div>

      {tabParam === 'compartidos'
        ? <GastosCompartidos month={month} year={year} />
        : <GastosLuro        month={month} year={year} />}
    </div>
  )
}

// ── GastosCompartidos ─────────────────────────────────────────────────────────
function GastosCompartidos({ month, year }: { month: string; year: number }) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [edits, setEdits]       = useState<Record<number, any>>({})

  const load = useCallback(() => {
    api.get<any[]>(`/expenses/shared/${year}/${month}`).then(rows => {
      setExpenses(rows)
      setEdits({})
    })
  }, [month, year])

  useEffect(() => { load() }, [load])

  const setField = (id: number, key: string, value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  const save = async (id: number) => {
    const edit = edits[id]
    if (!edit || Object.keys(edit).length === 0) return
    await api.put(`/expenses/shared/${id}`, edit)
    load()
  }

  // Totals from server values (or edited total_amount for preview)
  const totalGeneral    = expenses.reduce((a, e) => a + (parseFloat(edits[e.id]?.total_amount ?? e.total_amount) || 0), 0)
  const totalLuro       = expenses.reduce((a, e) => a + (parseFloat(edits[e.id]?.luro_amount   ?? e.luro_amount)  || 0), 0)
  const totalIndep      = totalGeneral - totalLuro

  const exportPDF = () => {
    const rows = expenses.map(e => ({
      item:     e.item_name,
      cat:      e.category ?? '',
      total:    parseFloat(edits[e.id]?.total_amount ?? e.total_amount) || 0,
      luro:     parseFloat(edits[e.id]?.luro_amount  ?? e.luro_amount)  || 0,
      due:      e.due_date ?? '',
      detail:   e.detail   ?? '',
      paid:     (edits[e.id]?.paid_status ?? e.paid_status) === 'SI' ? 'SI' : 'NO',
    }))

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Gastos Compartidos ${month} ${year}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; margin: 32px; }
  h2 { font-size: 16px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 11px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #f0ede8; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; border-bottom: 2px solid #c8a87a; }
  td { padding: 5px 8px; border-bottom: 1px solid #e8e4df; }
  .num { text-align: right; }
  .paid-si { color: #16a34a; font-weight: bold; }
  .paid-no { color: #dc2626; }
  .tfoot td { background: #f0ede8; font-weight: bold; border-top: 2px solid #c8a87a; }
  .summary { margin-top: 24px; display: flex; gap: 24px; }
  .summary-box { border: 1px solid #c8a87a; border-radius: 6px; padding: 12px 20px; min-width: 160px; }
  .summary-box .label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: .5px; }
  .summary-box .value { font-size: 16px; font-weight: bold; margin-top: 2px; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h2>Gastos Compartidos</h2>
<div class="sub">${month} ${year} &nbsp;·&nbsp; Distribución entre Luro e Independencia</div>
<table>
  <thead><tr>
    <th>Ítem</th><th>Categoría</th><th>Vencimiento</th><th>Detalle</th>
    <th class="num">Total $</th><th class="num">Luro $</th><th class="num">Indep. $</th><th>Pagado</th>
  </tr></thead>
  <tbody>
    ${rows.map(r => `<tr>
      <td>${r.item}</td>
      <td>${r.cat}</td>
      <td>${r.due}</td>
      <td>${r.detail}</td>
      <td class="num">${fmt$(r.total)}</td>
      <td class="num">${fmt$(r.luro)}</td>
      <td class="num">${fmt$(r.total - r.luro)}</td>
      <td class="${r.paid === 'SI' ? 'paid-si' : 'paid-no'}">${r.paid}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot><tr>
    <td colspan="4">TOTAL MES</td>
    <td class="num">${fmt$(totalGeneral)}</td>
    <td class="num">${fmt$(totalLuro)}</td>
    <td class="num">${fmt$(totalIndep)}</td>
    <td></td>
  </tr></tfoot>
</table>
<div class="summary">
  <div class="summary-box">
    <div class="label">Total General</div>
    <div class="value">${fmt$(totalGeneral)}</div>
  </div>
  <div class="summary-box">
    <div class="label">Luro paga</div>
    <div class="value">${fmt$(totalLuro)}</div>
  </div>
  <div class="summary-box">
    <div class="label">Independencia debe</div>
    <div class="value">${fmt$(totalIndep)}</div>
  </div>
</div>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 400)
  }

  return (
    <div className="space-y-4">
      {/* KPIs + PDF */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex gap-3">
          <div className="kpi-card py-2 px-3">
            <span className="kpi-label text-[10px]">Total General</span>
            <span className="kpi-value text-base">{fmt$(totalGeneral)}</span>
          </div>
          <div className="kpi-card py-2 px-3">
            <span className="kpi-label text-[10px]">Luro paga</span>
            <span className="kpi-value text-base">{fmt$(totalLuro)}</span>
          </div>
          <div className="kpi-card py-2 px-3">
            <span className="kpi-label text-[10px]">Independencia debe</span>
            <span className="kpi-value text-base">{fmt$(totalIndep)}</span>
          </div>
        </div>
        <button onClick={exportPDF} className="btn-ghost text-sm">
          <FileDown size={15} /> PDF
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-wood-50 border-b border-wood-100">
              <tr>
                <th className="table-th">Item</th>
                <th className="table-th">Categoria</th>
                <th className="table-th">Vencimiento</th>
                <th className="table-th">Detalle</th>
                <th className="table-th text-right">Total $</th>
                <th className="table-th text-right">Luro $</th>
                <th className="table-th text-right">Indep. $</th>
                <th className="table-th text-center">Pagado</th>
                <th className="table-th" />
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => {
                const edit     = edits[e.id] ?? {}
                const isDirty  = !!edits[e.id] && Object.keys(edits[e.id]).length > 0
                const total    = parseFloat(edit.total_amount ?? e.total_amount) || 0
                const luro     = parseFloat(edit.luro_amount  ?? e.luro_amount)  || 0
                const indep    = total - luro
                const paid     = edit.paid_status ?? e.paid_status

                return (
                  <tr key={e.id} className="table-tr">
                    {/* Item */}
                    <td className="table-td text-xs font-medium">{e.item_name}</td>
                    {/* Categoría */}
                    <td className="table-td text-xs text-wood-500">{e.category ?? '—'}</td>
                    {/* Vencimiento */}
                    <td className="table-td p-1">
                      <input type="date"
                        className="input py-1 px-2 text-xs w-32"
                        value={edit.due_date ?? (e.due_date ?? '')}
                        onChange={ev => setField(e.id, 'due_date', ev.target.value || null)}
                        onBlur={() => save(e.id)}
                      />
                    </td>
                    {/* Detalle */}
                    <td className="table-td p-1">
                      <input type="text" placeholder="—"
                        className="input py-1 px-2 text-xs w-36"
                        value={edit.detail ?? (e.detail ?? '')}
                        onChange={ev => setField(e.id, 'detail', ev.target.value || null)}
                        onBlur={() => save(e.id)}
                      />
                    </td>
                    {/* Total $ */}
                    <td className="table-td p-1">
                      <input type="number" placeholder="0"
                        className="input py-1 px-2 text-xs text-right w-28"
                        value={edit.total_amount ?? fmt0(e.total_amount)}
                        onChange={ev => {
                          const val = ev.target.value
                          const num = parseFloat(val)
                          // Auto-preview: luro = total/2 if user hasn't manually set luro
                          if (!isNaN(num) && edit.luro_amount === undefined) {
                            setEdits(prev => ({
                              ...prev,
                              [e.id]: { ...prev[e.id], total_amount: val, _autoLuro: num / 2 },
                            }))
                          } else {
                            setField(e.id, 'total_amount', val || null)
                          }
                        }}
                        onBlur={() => save(e.id)}
                      />
                    </td>
                    {/* Luro $ — editable override */}
                    <td className="table-td p-1">
                      <input type="number" placeholder="auto"
                        className="input py-1 px-2 text-xs text-right w-28"
                        value={edit.luro_amount ?? fmt0(e.luro_amount)}
                        onChange={ev => setField(e.id, 'luro_amount', ev.target.value || null)}
                        onBlur={() => save(e.id)}
                      />
                    </td>
                    {/* Independencia $ — computed */}
                    <td className="table-td text-xs text-right font-medium text-wood-600">
                      {indep > 0 ? fmt$(indep) : '—'}
                    </td>
                    {/* Pagado */}
                    <td className="table-td text-center p-1">
                      <button
                        onClick={async () => {
                          const newPaid = paid === 'SI' ? 'NO' : 'SI'
                          setField(e.id, 'paid_status', newPaid)
                          await api.put(`/expenses/shared/${e.id}`, { paid_status: newPaid })
                          load()
                        }}
                        className={[
                          'badge cursor-pointer',
                          paid === 'SI' ? 'badge-green' : 'badge-red',
                        ].join(' ')}>
                        {paid === 'SI' ? 'SI' : 'NO'}
                      </button>
                    </td>
                    {/* Guardar */}
                    <td className="table-td p-1 w-10">
                      {isDirty && (
                        <button onClick={() => save(e.id)} className="btn-primary text-xs py-1 px-2">OK</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-wood-50 border-t-2 border-wood-200">
                <td colSpan={4} className="table-td font-bold text-xs">TOTAL MES</td>
                <td className="table-td text-xs text-right font-bold">{fmt$(totalGeneral)}</td>
                <td className="table-td text-xs text-right font-bold">{fmt$(totalLuro)}</td>
                <td className="table-td text-xs text-right font-bold">{fmt$(totalIndep)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-wood-400">
        Luro adelanta todos los gastos. Independencia reintegra su parte (columna Indep. $).
        Para items exclusivos de una sucursal, edite manualmente el campo "Luro $".
      </p>
    </div>
  )
}

// ── GastosLuro ────────────────────────────────────────────────────────────────
function GastosLuro({ month, year }: { month: string; year: number }) {
  const [expenses, setExpenses]     = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [adding, setAdding]         = useState(false)
  const [form, setForm]             = useState({
    expense_date: '', category_id: '', subcategory_id: '', detail: '', amount: '', payment_method: '',
  })

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
            <option value="">Categoria *</option>
            {mainCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={form.subcategory_id}
            onChange={e => setForm(f => ({ ...f, subcategory_id: e.target.value }))}>
            <option value="">Subcategoria</option>
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
                <th className="table-th">Categoria</th>
                <th className="table-th">Subcategoria</th>
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
