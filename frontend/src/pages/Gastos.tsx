import { useEffect, useState, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Trash2, FileDown, Pencil, Check, X } from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR } from '../api'

type Tab = 'compartidos' | 'luro'

// ── Items fijos — editar aquí para agregar/quitar filas permanentes ──────────
// split: 'half'  → Indep paga el 50%  (se auto-calcula al ingresar Total)
// split: 'full'  → Indep paga el 100% (ítem exclusivo de Independencia)
type SplitType = 'half' | 'full'
const FIXED_ITEMS: { key: string; name: string; category: string; split: SplitType }[] = [
  // Impuestos y cargas sociales
  { key: 'f931',       name: 'Formulario 931',               category: 'Impuestos',       split: 'half' },
  { key: 'iva',        name: 'IVA',                          category: 'Impuestos',       split: 'half' },
  { key: 'autonomo',   name: 'Autónomo',                     category: 'Impuestos',       split: 'half' },
  { key: 'iibb',       name: 'Ingresos Brutos',              category: 'Impuestos',       split: 'half' },
  { key: 'tsh',        name: 'Tasa de Seguridad e Higiene',  category: 'Impuestos',       split: 'half' },
  // Sindicatos y obras sociales
  { key: 'sec',        name: 'SEC',                          category: 'Sindicatos',      split: 'half' },
  { key: 'faecys',     name: 'FAECYS',                       category: 'Sindicatos',      split: 'half' },
  { key: 'osecac',     name: 'OSECAC',                       category: 'Sindicatos',      split: 'half' },
  { key: 'usimra',     name: 'USIMRA',                       category: 'Sindicatos',      split: 'half' },
  // Administración y servicios
  { key: 'inacap',     name: 'INACAP',                       category: 'Administración',  split: 'half' },
  { key: 'contador',   name: 'Contador',                     category: 'Administración',  split: 'half' },
  { key: 'hosting',    name: 'Hosting web',                  category: 'Administración',  split: 'half' },
  { key: 'claro',      name: 'Claro',                        category: 'Servicios',       split: 'half' },
  { key: 'seguro',     name: 'Seguro de comercio integral',  category: 'Servicios',       split: 'half' },
  { key: 'posnet',     name: 'POSNET (2 terminales)',        category: 'Servicios',       split: 'full' },
  // Personal
  { key: 'avila',      name: 'Avila, Alejandro',             category: 'Personal',        split: 'half' },
  { key: 'salinas',    name: 'Salinas, Adrian',              category: 'Personal',        split: 'half' },
  { key: 'ponasso',    name: 'Ponasso, Martin',              category: 'Personal',        split: 'half' },
  { key: 'juana',      name: 'Juana',                        category: 'Personal',        split: 'half' },
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
          <p className="text-brand-muted text-sm">Compartidos entre sucursales · Gastos Luro</p>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)} className="input w-36 text-sm">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="flex gap-2 border-b border-brand-border pb-0">
        {(['compartidos', 'luro'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              tabParam === t
                ? 'bg-white border border-b-white border-brand-border text-brand-body -mb-px'
                : 'text-brand-muted hover:text-brand-body',
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
  const [dbData, setDbData]     = useState<Record<string, any>>({})
  const [edits, setEdits]       = useState<Record<string, any>>({})
  const savingRef               = useRef<Record<string, boolean>>({})
  const [addingCustom, setAddingCustom] = useState(false)
  const [customForm, setCustomForm]     = useState({ name: '', split_type: 'half' as SplitType })
  const [savingCustom, setSavingCustom] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editForm, setEditForm]     = useState({ pct: '50', detail: '', name: '' })

  const customItems = Object.values(dbData).filter((r: any) => r.item_key?.startsWith('custom_'))

  const load = useCallback(() => {
    api.get<Record<string, any>>(`/expenses/compartidos/${year}/${month}`).then(data => {
      setDbData(data)
      setEdits({})
    })
  }, [month, year])

  useEffect(() => { load() }, [load])

  const setField = (key: string, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

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

  const merged = (key: string) => ({ ...dbData[key], ...edits[key] })

  const autoIndep = (key: string, total: number): number => {
    const fixed = FIXED_ITEMS.find(i => i.key === key)
    if (fixed) return fixed.split === 'full' ? total : total / 2
    const db = dbData[key]
    return db?.split_type === 'full' ? total : total / 2
  }

  const getIndep = (key: string) => {
    const m = merged(key)
    const total = parseFloat(m?.total_amount) || 0
    if (total === 0) return 0
    return m?.indep_amount != null ? parseFloat(m.indep_amount) : autoIndep(key, total)
  }

  const openEdit = (key: string) => {
    if (editingKey === key) { setEditingKey(null); return }
    const m     = merged(key)
    const total = parseFloat(m?.total_amount) || 0
    const indep = getIndep(key)
    const fixedItem = FIXED_ITEMS.find(i => i.key === key)
    const defaultPct = fixedItem?.split === 'full' ? 100 : 50
    const pct = total > 0 ? Math.round((indep / total) * 100) : defaultPct
    setEditForm({ pct: String(pct), detail: m?.detail ?? '', name: m?.custom_name ?? '' })
    setEditingKey(key)
  }

  const applyEdit = async (key: string) => {
    const m     = merged(key)
    const total = parseFloat(m?.total_amount) || 0
    const pct   = Math.min(100, Math.max(0, parseFloat(editForm.pct) || 0))
    await saveField(key, 'indep_amount', total * (pct / 100))
    await saveField(key, 'detail', editForm.detail || null)
    if (key.startsWith('custom_') && editForm.name.trim()) {
      await saveField(key, 'custom_name', editForm.name.trim())
    }
    load()
    setEditingKey(null)
  }

  const addCustomItem = async () => {
    if (!customForm.name.trim()) return
    setSavingCustom(true)
    const row = await api.post<any>(`/expenses/compartidos/${year}/${month}/custom`, {
      name: customForm.name.trim(), split_type: customForm.split_type,
    })
    setDbData(prev => ({ ...prev, [row.item_key]: row }))
    setCustomForm({ name: '', split_type: 'half' })
    setAddingCustom(false)
    setSavingCustom(false)
  }

  const deleteCustomItem = async (key: string) => {
    await api.delete(`/expenses/compartidos/${year}/${month}/${key}`)
    setDbData(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  // ── Render de cada fila (fija o custom) ─────────────────────────────────────
  const renderRow = (
    key: string,
    name: string,
    isCustom: boolean,
  ) => {
    const m         = merged(key)
    const total     = parseFloat(m?.total_amount) || 0
    const indep     = getIndep(key)
    const luro      = total - indep
    const paid      = m?.paid_status ?? 'NO'
    const split     = isCustom ? (m?.split_type ?? 'half') : (FIXED_ITEMS.find(i => i.key === key)?.split ?? 'half')
    const rawPct    = total > 0 ? Math.round((indep / total) * 100) : (split === 'full' ? 100 : 50)
    const isEditing = editingKey === key

    return (
      <>
        <tr key={key} className={['table-tr', isEditing ? 'bg-coral/5' : ''].join(' ')}>
          {/* Concepto */}
          <td className="table-td text-xs font-medium">
            {isCustom ? (
              <div className="flex items-center gap-2">
                <span>{m?.custom_name ?? key}</span>
                <button onClick={() => deleteCustomItem(key)} className="text-red-300 hover:text-red-500">
                  <Trash2 size={11} />
                </button>
              </div>
            ) : name}
          </td>

          {/* % Indep */}
          <td className="table-td text-center">
            <span className={[
              'text-xs font-bold px-2 py-0.5 rounded-full',
              rawPct === 100 ? 'bg-coral/20 text-coral-dark' : 'bg-brand-border text-brand-body',
            ].join(' ')}>
              {rawPct}%
            </span>
          </td>

          {/* Monto total — input editable */}
          <td className="table-td p-1">
            <input
              type="number" placeholder="0"
              className="input py-1 px-2 text-xs text-right w-36"
              value={edits[key]?.total_amount ?? (m?.total_amount != null ? String(m.total_amount) : '')}
              onChange={ev => setField(key, 'total_amount', ev.target.value)}
              onBlur={async ev => {
                const val = parseFloat(ev.target.value)
                if (isNaN(val)) return
                await saveField(key, 'total_amount', val)
                await saveField(key, 'indep_amount', autoIndep(key, val))
                setEdits(prev => { const n = { ...prev }; delete n[key]; return n })
                load()
              }}
            />
          </td>

          {/* Independencia paga — read-only */}
          <td className="table-td text-xs text-right font-semibold text-brand-body">
            {total > 0 ? fmt$(indep) : <span className="text-brand-muted">—</span>}
          </td>

          {/* Luro neto — read-only */}
          <td className="table-td text-xs text-right text-brand-muted">
            {total > 0 ? fmt$(luro) : <span className="text-brand-muted">—</span>}
          </td>

          {/* Pagado */}
          <td className="table-td text-center">
            <button
              onClick={async () => { await saveField(key, 'paid_status', paid === 'SI' ? 'NO' : 'SI'); load() }}
              className={['badge cursor-pointer', paid === 'SI' ? 'badge-green' : 'badge-red'].join(' ')}>
              {paid === 'SI' ? 'SI' : 'NO'}
            </button>
          </td>

          {/* Lápiz editar */}
          <td className="table-td text-center p-1">
            <button
              onClick={() => openEdit(key)}
              title="Editar porcentaje y detalle"
              className={[
                'p-1 rounded transition-colors',
                isEditing ? 'text-coral bg-coral/10' : 'text-brand-muted hover:text-brand-body',
              ].join(' ')}>
              <Pencil size={13} />
            </button>
          </td>
        </tr>

        {/* Panel de edición inline */}
        {isEditing && (
          <tr key={`${key}-edit`} className="bg-coral/5 border-b border-brand-border">
            <td colSpan={7} className="px-6 py-4">
              <div className="flex flex-wrap items-end gap-4">
                {/* Nombre (solo custom) */}
                {isCustom && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Nombre del item</label>
                    <input type="text"
                      className="input py-1 px-2 text-xs w-44"
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                )}
                {/* % Independencia */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">% que paga Independencia</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="100"
                      className="input py-1 px-2 text-xs text-right w-20"
                      value={editForm.pct}
                      onChange={e => setEditForm(f => ({ ...f, pct: e.target.value }))}
                    />
                    <span className="text-xs text-brand-muted">%</span>
                  </div>
                </div>
                {/* Nota */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Nota / Detalle</label>
                  <input type="text" placeholder="Opcional..."
                    className="input py-1 px-2 text-xs w-56"
                    value={editForm.detail}
                    onChange={e => setEditForm(f => ({ ...f, detail: e.target.value }))}
                  />
                </div>
                {/* Acciones */}
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => applyEdit(key)}
                    className="btn-primary text-xs py-1 px-3 flex items-center gap-1">
                    <Check size={13} /> Guardar
                  </button>
                  <button onClick={() => setEditingKey(null)}
                    className="btn-ghost text-xs py-1 px-3 flex items-center gap-1">
                    <X size={13} /> Cancelar
                  </button>
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    )
  }

  // ── Totales ──────────────────────────────────────────────────────────────────
  const allKeys      = [...FIXED_ITEMS.map(i => i.key), ...customItems.map((r: any) => r.item_key)]
  const totalGeneral = allKeys.reduce((a, k) => a + (parseFloat(merged(k)?.total_amount) || 0), 0)
  const totalIndep   = allKeys.reduce((a, k) => a + getIndep(k), 0)
  const totalLuro    = totalGeneral - totalIndep

  // ── Categorías únicas para agrupar ───────────────────────────────────────────
  const categories = [...new Set(FIXED_ITEMS.map(i => i.category))]

  // ── PDF ──────────────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const fixedRows = FIXED_ITEMS.map(item => {
      const m = merged(item.key)
      const total = parseFloat(m?.total_amount) || 0
      const indep = getIndep(item.key)
      return { name: item.name, cat: item.category, total, indep, luro: total - indep,
               due: m?.due_date ?? '', detail: m?.detail ?? '', paid: m?.paid_status ?? 'NO' }
    }).filter(r => r.total > 0)
    const customRows = customItems.map((row: any) => {
      const m = merged(row.item_key)
      const total = parseFloat(m?.total_amount) || 0
      const indep = getIndep(row.item_key)
      return { name: m?.custom_name ?? row.item_key, cat: 'Personalizado', total, indep, luro: total - indep,
               due: m?.due_date ?? '', detail: m?.detail ?? '', paid: m?.paid_status ?? 'NO' }
    }).filter((r: any) => r.total > 0)
    const rows = [...fixedRows, ...customRows]

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
</style></head><body>
<h2>Gastos Compartidos</h2>
<div class="sub">${month} ${year} &nbsp;·&nbsp; Distribución Luro / Independencia</div>
<table>
  <thead><tr>
    <th>Item</th><th>Categoria</th><th>Detalle</th>
    <th class="num">Total $</th><th class="num">Indep. $</th><th class="num">Luro $</th><th>Pagado</th>
  </tr></thead>
  <tbody>
    ${rows.map(r => `<tr>
      <td>${r.name}</td><td>${r.cat}</td><td>${r.detail}</td>
      <td class="num">${fmt$(r.total)}</td>
      <td class="num">${fmt$(r.indep)}</td>
      <td class="num">${fmt$(r.luro)}</td>
      <td class="${r.paid === 'SI' ? 'paid-si' : 'paid-no'}">${r.paid}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot><tr>
    <td colspan="3">TOTAL MES</td>
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

  // ── JSX ──────────────────────────────────────────────────────────────────────
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

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-navy text-white">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Concepto</th>
                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest">
                  % Indep.
                  <div className="font-normal text-white/60 text-[10px] normal-case leading-tight tracking-normal">porcentaje a cargo</div>
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest">
                  Monto total $
                  <div className="font-normal text-white/60 text-[10px] normal-case leading-tight tracking-normal">lo que adelanta Luro</div>
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest">
                  Independencia paga $
                  <div className="font-normal text-white/60 text-[10px] normal-case leading-tight tracking-normal">lo que debe reintegrar</div>
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest">
                  Luro neto $
                  <div className="font-normal text-white/60 text-[10px] normal-case leading-tight tracking-normal">queda a cargo de Luro</div>
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest">Pagado</th>
                <th className="px-4 py-3 w-10 text-center text-[11px] font-normal uppercase tracking-widest opacity-60">Edit.</th>
              </tr>
            </thead>
            <tbody>
              {/* Items fijos agrupados por categoría */}
              {categories.map(cat => (
                <>
                  <tr key={`cat-${cat}`} className="bg-brand-off-white">
                    <td colSpan={7} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted border-t border-brand-border">
                      {cat}
                    </td>
                  </tr>
                  {FIXED_ITEMS.filter(i => i.category === cat).map(item =>
                    renderRow(item.key, item.name, false)
                  )}
                </>
              ))}

              {/* Items personalizados */}
              {customItems.length > 0 && (
                <tr key="cat-custom" className="bg-brand-off-white">
                  <td colSpan={7} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted border-t border-brand-border">
                    Personalizados
                  </td>
                </tr>
              )}
              {customItems.map((row: any) =>
                renderRow(row.item_key, row.custom_name ?? row.item_key, true)
              )}

              {/* Fila de totales */}
              <tr className="bg-brand-off-white border-t-2 border-brand-border font-bold text-xs">
                <td className="table-td" colSpan={2}>TOTAL MES</td>
                <td className="table-td text-right">{fmt$(totalGeneral)}</td>
                <td className="table-td text-right">{fmt$(totalIndep)}</td>
                <td className="table-td text-right">{fmt$(totalLuro)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Agregar item personalizado */}
      {addingCustom ? (
        <div className="card p-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-brand-muted uppercase tracking-wide">Nombre del item *</label>
            <input type="text" placeholder="ej: Monotributo" autoFocus
              className="input py-1 px-2 text-xs w-48"
              value={customForm.name}
              onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addCustomItem()}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-brand-muted uppercase tracking-wide">Reparto</label>
            <select className="input py-1 px-2 text-xs w-36"
              value={customForm.split_type}
              onChange={e => setCustomForm(f => ({ ...f, split_type: e.target.value as SplitType }))}>
              <option value="half">Mitad (50/50)</option>
              <option value="full">Total Independencia</option>
            </select>
          </div>
          <button onClick={addCustomItem} disabled={savingCustom || !customForm.name.trim()}
            className="btn-primary text-xs py-1 px-3">
            {savingCustom ? 'Guardando...' : 'Agregar'}
          </button>
          <button onClick={() => setAddingCustom(false)} className="btn-ghost text-xs py-1 px-3">Cancelar</button>
        </div>
      ) : (
        <button onClick={() => setAddingCustom(true)}
          className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-body transition-colors">
          <Plus size={13} /> Agregar item personalizado
        </button>
      )}
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
            <thead className="bg-brand-off-white border-b border-brand-border">
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
                  <td className="table-td text-xs text-brand-muted">{e.subcategory_name ?? '—'}</td>
                  <td className="table-td text-xs">{e.detail ?? '—'}</td>
                  <td className="table-td text-xs text-right font-medium">{fmt$(parseFloat(e.amount))}</td>
                  <td className="table-td text-xs text-brand-muted">{e.payment_method ?? '—'}</td>
                  <td className="table-td p-1">
                    <button onClick={async () => { await api.delete(`/expenses/luro/${e.id}`); load() }}
                      className="text-red-400 hover:text-red-600 transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan={7} className="table-td text-center text-brand-muted py-10">No hay gastos para {month} {year}</td></tr>
              )}
              <tr className="bg-brand-off-white border-t-2 border-brand-border">
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
