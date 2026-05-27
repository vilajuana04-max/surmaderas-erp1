import { useEffect, useState, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Trash2, FileDown } from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR } from '../api'

type Tab = 'compartidos' | 'luro'

// ── Items fijos — editar aquí para agregar/quitar filas ──────────────────────
// split: 'half'  → Indep paga el 50%  (se auto-calcula al ingresar Total)
// split: 'full'  → Indep paga el 100% (ítem exclusivo de Independencia)
type SplitType = 'half' | 'full'
const FIXED_ITEMS: { key: string; name: string; category: string; split: SplitType }[] = [
  { key: 'luz',        name: 'Luz / Energía Eléctrica',    category: 'Servicios',              split: 'half' },
  { key: 'gas',        name: 'Gas',                        category: 'Servicios',              split: 'half' },
  { key: 'agua',       name: 'Agua',                       category: 'Servicios',              split: 'half' },
  { key: 'internet',   name: 'Internet',                   category: 'Servicios',              split: 'half' },
  { key: 'telefono',   name: 'Teléfono',                   category: 'Servicios',              split: 'half' },
  { key: 'alarma',     name: 'Alarma',                     category: 'Seguridad',              split: 'half' },
  { key: 'seguro',     name: 'Seguro',                     category: 'Seguridad',              split: 'half' },
  { key: 'expensas',   name: 'Expensas',                   category: 'Edificio',               split: 'half' },
  { key: 'alquiler',   name: 'Alquiler',                   category: 'Edificio',               split: 'half' },
  { key: 'contador',   name: 'Contador / Estudio Contable',category: 'Administración',         split: 'half' },
  { key: 'inacap',     name: 'INACAP',                     category: 'Gestión de empleados',   split: 'half' },
  { key: 'avila',      name: 'Sueldo Avila Alejandro',     category: 'Personal Independencia', split: 'full' },
  { key: 'salinas',    name: 'Sueldo Salinas Adrian',      category: 'Personal Independencia', split: 'full' },
  { key: 'ponasso',    name: 'Sueldo Ponasso Martin',      category: 'Personal Independencia', split: 'full' },
  { key: 'limpieza',   name: 'Limpieza',                   category: 'Varios',                 split: 'half' },
  { key: 'otros',      name: 'Otros',                      category: 'Varios',                 split: 'half' },
]

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
  // dbData: { [item_key]: { total_amount, indep_amount, due_date, detail, paid_status } }
  const [dbData, setDbData] = useState<Record<string, any>>({})
  // localEdits: { [item_key]: { field: value } } — live while typing
  const [edits, setEdits]   = useState<Record<string, any>>({})
  const savingRef           = useRef<Record<string, boolean>>({})

  const load = useCallback(() => {
    api.get<Record<string, any>>(`/expenses/compartidos/${year}/${month}`).then(data => {
      setDbData(data)
      setEdits({})
    })
  }, [month, year])

  useEffect(() => { load() }, [load])

  // Set a field in localEdits for a given item key
  const setField = (key: string, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  // Save one field for an item key to the server
  const saveField = async (key: string, field: string, value: any) => {
    if (savingRef.current[key]) return
    savingRef.current[key] = true
    try {
      const updated = await api.put<any>(`/expenses/compartidos/${year}/${month}/${key}`, { [field]: value })
      setDbData(prev => ({ ...prev, [key]: updated }))
    } finally {
      savingRef.current[key] = false
    }
  }

  // Merge db + local for a given item key
  const merged = (key: string) => ({ ...dbData[key], ...edits[key] })

  // Compute indep_amount based on split type when total changes
  const autoIndep = (key: string, total: number): number => {
    const item = FIXED_ITEMS.find(i => i.key === key)
    return item?.split === 'full' ? total : total / 2
  }

  // Totals
  const totalGeneral = FIXED_ITEMS.reduce((a, i) => a + (parseFloat(merged(i.key)?.total_amount) || 0), 0)
  const totalIndep   = FIXED_ITEMS.reduce((a, i) => a + (parseFloat(merged(i.key)?.indep_amount) || 0), 0)
  const totalLuro    = totalGeneral - totalIndep

  const exportPDF = () => {
    const rows = FIXED_ITEMS.map(item => {
      const m = merged(item.key)
      const total = parseFloat(m?.total_amount) || 0
      const indep = parseFloat(m?.indep_amount) || 0
      return { name: item.name, cat: item.category, total, indep, luro: total - indep,
               due: m?.due_date ?? '', detail: m?.detail ?? '', paid: m?.paid_status ?? 'NO' }
    }).filter(r => r.total > 0)

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Gastos Compartidos ${month} ${year}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;margin:32px}
  h2{font-size:16px;margin-bottom:4px}
  .sub{color:#666;font-size:11px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th{background:#f0ede8;text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #c8a87a}
  td{padding:5px 8px;border-bottom:1px solid #e8e4df}
  .num{text-align:right}
  .paid-si{color:#16a34a;font-weight:bold}
  .paid-no{color:#dc2626}
  .tfoot td{background:#f0ede8;font-weight:bold;border-top:2px solid #c8a87a}
  .summary{margin-top:24px;display:flex;gap:24px}
  .summary-box{border:1px solid #c8a87a;border-radius:6px;padding:12px 20px;min-width:160px}
  .summary-box .label{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.5px}
  .summary-box .value{font-size:16px;font-weight:bold;margin-top:2px}
  @media print{body{margin:20px}}
</style></head><body>
<h2>Gastos Compartidos</h2>
<div class="sub">${month} ${year} &nbsp;·&nbsp; Distribución Luro / Independencia</div>
<table>
  <thead><tr>
    <th>Item</th><th>Categoria</th><th>Vto.</th><th>Detalle</th>
    <th class="num">Total $</th><th class="num">Indep. $</th><th class="num">Luro $</th><th>Pagado</th>
  </tr></thead>
  <tbody>
    ${rows.map(r => `<tr>
      <td>${r.name}</td><td>${r.cat}</td><td>${r.due}</td><td>${r.detail}</td>
      <td class="num">${fmt$(r.total)}</td>
      <td class="num">${fmt$(r.indep)}</td>
      <td class="num">${fmt$(r.luro)}</td>
      <td class="${r.paid === 'SI' ? 'paid-si' : 'paid-no'}">${r.paid}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot><tr>
    <td colspan="4">TOTAL MES</td>
    <td class="num">${fmt$(totalGeneral)}</td>
    <td class="num">${fmt$(totalIndep)}</td>
    <td class="num">${fmt$(totalLuro)}</td>
    <td></td>
  </tr></tfoot>
</table>
<div class="summary">
  <div class="summary-box"><div class="label">Total General</div><div class="value">${fmt$(totalGeneral)}</div></div>
  <div class="summary-box"><div class="label">Independencia debe</div><div class="value">${fmt$(totalIndep)}</div></div>
  <div class="summary-box"><div class="label">Luro neto</div><div class="value">${fmt$(totalLuro)}</div></div>
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
        <div className="flex gap-3 flex-wrap">
          <div className="kpi-card py-2 px-3">
            <span className="kpi-label text-[10px]">Total General</span>
            <span className="kpi-value text-base">{fmt$(totalGeneral)}</span>
          </div>
          <div className="kpi-card py-2 px-3">
            <span className="kpi-label text-[10px]">Independencia debe</span>
            <span className="kpi-value text-base">{fmt$(totalIndep)}</span>
          </div>
          <div className="kpi-card py-2 px-3">
            <span className="kpi-label text-[10px]">Luro neto</span>
            <span className="kpi-value text-base">{fmt$(totalLuro)}</span>
          </div>
        </div>
        <button onClick={exportPDF} className="btn-ghost text-sm">
          <FileDown size={15} /> PDF
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-wood-50 border-b border-wood-100">
              <tr>
                <th className="table-th">Item</th>
                <th className="table-th">Categoria</th>
                <th className="table-th text-right">Total $</th>
                <th className="table-th text-right">Indep. $</th>
                <th className="table-th text-right">Luro $</th>
                <th className="table-th">Vencimiento</th>
                <th className="table-th">Detalle</th>
                <th className="table-th text-center">Pagado</th>
              </tr>
            </thead>
            <tbody>
              {FIXED_ITEMS.map(item => {
                const m     = merged(item.key)
                const total = parseFloat(m?.total_amount) || 0
                const indep = parseFloat(m?.indep_amount) || 0
                const luro  = total - indep
                const paid  = m?.paid_status ?? 'NO'

                return (
                  <tr key={item.key} className="table-tr">
                    {/* Item */}
                    <td className="table-td text-xs font-medium">{item.name}</td>
                    {/* Categoria */}
                    <td className="table-td text-xs text-wood-400">{item.category}</td>
                    {/* Total $ */}
                    <td className="table-td p-1">
                      <input
                        type="number" placeholder="0"
                        className="input py-1 px-2 text-xs text-right w-28"
                        value={edits[item.key]?.total_amount ?? (m?.total_amount != null ? String(m.total_amount) : '')}
                        onChange={ev => {
                          const val = ev.target.value
                          const num = parseFloat(val)
                          setEdits(prev => ({
                            ...prev,
                            [item.key]: {
                              ...prev[item.key],
                              total_amount: val,
                              // auto-set indep unless user has already overridden it
                              ...(prev[item.key]?.indep_amount === undefined && !isNaN(num)
                                ? { indep_amount: String(autoIndep(item.key, num)) }
                                : {}),
                            },
                          }))
                        }}
                        onBlur={async ev => {
                          const val = parseFloat(ev.target.value)
                          if (isNaN(val)) return
                          const indepVal = parseFloat(edits[item.key]?.indep_amount) ?? autoIndep(item.key, val)
                          await saveField(item.key, 'total_amount', val)
                          await saveField(item.key, 'indep_amount', isNaN(indepVal) ? autoIndep(item.key, val) : indepVal)
                          setEdits(prev => { const n = { ...prev }; delete n[item.key]; return n })
                        }}
                      />
                    </td>
                    {/* Indep. $ — editable, auto-filled based on split */}
                    <td className="table-td p-1">
                      <input
                        type="number" placeholder="auto"
                        className="input py-1 px-2 text-xs text-right w-28"
                        value={edits[item.key]?.indep_amount ?? (m?.indep_amount != null ? String(m.indep_amount) : '')}
                        onChange={ev => setField(item.key, 'indep_amount', ev.target.value)}
                        onBlur={async ev => {
                          const val = parseFloat(ev.target.value)
                          if (isNaN(val)) return
                          await saveField(item.key, 'indep_amount', val)
                          setEdits(prev => { const n = { ...prev }; delete n[item.key]?.indep_amount; return n })
                        }}
                      />
                    </td>
                    {/* Luro $ — computed */}
                    <td className="table-td text-xs text-right font-medium text-wood-600">
                      {total > 0 ? fmt$(luro) : '—'}
                    </td>
                    {/* Vencimiento */}
                    <td className="table-td p-1">
                      <input
                        type="date"
                        className="input py-1 px-2 text-xs w-32"
                        value={edits[item.key]?.due_date ?? (m?.due_date ?? '')}
                        onChange={ev => setField(item.key, 'due_date', ev.target.value)}
                        onBlur={ev => saveField(item.key, 'due_date', ev.target.value || null)}
                      />
                    </td>
                    {/* Detalle */}
                    <td className="table-td p-1">
                      <input
                        type="text" placeholder="—"
                        className="input py-1 px-2 text-xs w-32"
                        value={edits[item.key]?.detail ?? (m?.detail ?? '')}
                        onChange={ev => setField(item.key, 'detail', ev.target.value)}
                        onBlur={ev => saveField(item.key, 'detail', ev.target.value || null)}
                      />
                    </td>
                    {/* Pagado */}
                    <td className="table-td text-center">
                      <button
                        onClick={async () => {
                          const np = paid === 'SI' ? 'NO' : 'SI'
                          await saveField(item.key, 'paid_status', np)
                          load()
                        }}
                        className={['badge cursor-pointer', paid === 'SI' ? 'badge-green' : 'badge-red'].join(' ')}>
                        {paid === 'SI' ? 'SI' : 'NO'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-wood-50 border-t-2 border-wood-200">
                <td colSpan={2} className="table-td font-bold text-xs">TOTAL MES</td>
                <td className="table-td text-xs text-right font-bold">{fmt$(totalGeneral)}</td>
                <td className="table-td text-xs text-right font-bold">{fmt$(totalIndep)}</td>
                <td className="table-td text-xs text-right font-bold">{fmt$(totalLuro)}</td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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
