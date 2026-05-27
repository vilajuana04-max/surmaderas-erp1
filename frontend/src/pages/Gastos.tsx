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

// ── Categorías de Gastos Luro (fijas en frontend) ────────────────────────────
const LURO_CATS: Record<string, string[]> = {
  'Varios':           ['Almacén', 'Artículos Limpieza', 'S - Otros', 'Adriana'],
  'Gastos_Fijos':     ['Edea', 'Alquiler', 'Obras sanitarias', 'Internet', 'G - Otros', 'FAECYS', 'U.S.I.M.R.A', 'SEGURO COMERCIO INTEGRAL', 'SEC', 'FORMULARIO 931', 'POSNET', 'CLARO', 'INACAP', 'MATAFUEGOS', 'CONTADOR'],
  'Sueldos':          ['Vazquez, Martin', 'Viejo, Marcelo', 'Viejo, Ariel', 'Vila, Cecilia', 'Vila, Juana', 'Vila, Guillermo', 'Lalli, Facundo', 'Rojo, Matias', 'Zicavo, Valentina', 'Scatizzi, Patricia'],
  'Proveedores':      ['Vila, Marcelo', 'Fito', 'Salinas, Ariel', 'Natanael', 'Beto', 'Silvia', 'Gonzalez Tudanca', 'LAR', 'San francisco', 'Decoforma', 'Adagio Sur', 'Solo cuadros'],
  'Transporte':       ['Valentin Flete', 'Gabi Flete', 'Transporte miramar'],
  'Impuestos':        ['I.V.A', 'Ingresos Brutos', 'IIGG', 'Bienes Personales', 'I - Otros', 'Tasa seguridad e higiene', 'Autonomo'],
  'Insumos':          ['Bolsas', 'Film stretch', 'Ferreteria', 'Ropa de trabajo'],
  'Aguinaldo':        ['Martin', 'Marcelo', 'Ariel', 'Cecilia', 'Jua', 'Guille', 'Facu', 'Pato'],
  'Marketing_Digital':['Hosting', 'Sitio WEB', 'Publicidad PAGA', 'Canva'],
  'Comision':         ['Martin Vazquez', 'Marcelo Viejo', 'Ariel Viejo', 'Cecilia Vila', 'Juana Vila', 'Guillermo Vila', 'Facundo Lalli', 'Pato Scatizzi'],
}
const MEDIOS_PAGO = ['Transferencia', 'Efectivo', 'Tarjeta', 'Cheque', 'Débito']

type LuroView = 'registro' | 'reporte'

// ── GastosLuro ────────────────────────────────────────────────────────────────
function GastosLuro({ month, year }: { month: string; year: number }) {
  const [view, setView] = useState<LuroView>('registro')

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {(['registro', 'reporte'] as LuroView[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={[
              'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              view === v ? 'bg-navy text-white' : 'bg-brand-off-white text-brand-muted hover:text-brand-body border border-brand-border',
            ].join(' ')}>
            {v === 'registro' ? 'Registro mensual' : 'Reporte anual'}
          </button>
        ))}
      </div>

      {view === 'registro'
        ? <LuroRegistro month={month} year={year} />
        : <LuroReporte  year={year} />}
    </div>
  )
}

// ── LuroRegistro ──────────────────────────────────────────────────────────────
function LuroRegistro({ month, year }: { month: string; year: number }) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [adding, setAdding]     = useState(false)
  const EMPTY_FORM = { expense_date: '', categoria: '', subcategoria: '', detail: '', amount: '', payment_method: '', pagado: 'NO' }
  const [form, setForm]         = useState(EMPTY_FORM)

  const subCats = form.categoria ? (LURO_CATS[form.categoria] ?? []) : []

  const load = useCallback(() => {
    api.get<any[]>(`/expenses/luro?month=${month}&year=${year}`).then(setExpenses)
  }, [month, year])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    await api.post('/expenses/luro', {
      expense_date:   form.expense_date || null,
      categoria:      form.categoria,
      subcategoria:   form.subcategoria || null,
      detail:         form.detail || null,
      amount:         parseFloat(form.amount),
      payment_method: form.payment_method || null,
      pagado:         form.pagado,
      month, year,
    })
    setAdding(false)
    setForm(EMPTY_FORM)
    load()
  }

  const togglePagado = async (id: number, current: string) => {
    await api.put(`/expenses/luro/${id}`, { pagado: current === 'SI' ? 'NO' : 'SI' })
    load()
  }

  const totalMes = expenses.reduce((a, e) => a + parseFloat(e.amount || 0), 0)

  // Resumen por categoría
  const resumen: Record<string, number> = {}
  for (const e of expenses) {
    const cat = e.categoria || 'Sin categoría'
    resumen[cat] = (resumen[cat] || 0) + parseFloat(e.amount || 0)
  }

  return (
    <div className="flex gap-4 items-start">
      {/* ── Tabla principal ── */}
      <div className="flex-1 space-y-3 min-w-0">
        {/* Toolbar */}
        <div className="flex justify-between items-center">
          <div className="kpi-card py-2 px-3 inline-flex flex-col">
            <span className="kpi-label text-[10px]">Total {month}</span>
            <span className="kpi-value text-base">{fmt$(totalMes)}</span>
          </div>
          <button onClick={() => setAdding(!adding)} className="btn-primary text-sm">
            <Plus size={15} /> Nuevo gasto
          </button>
        </div>

        {/* Formulario nuevo gasto */}
        {adding && (
          <form onSubmit={handleAdd} className="card grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Fecha</label>
              <input type="date" className="input text-sm" value={form.expense_date}
                onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Categoría *</label>
              <select className="input text-sm" value={form.categoria} required
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value, subcategoria: '' }))}>
                <option value="">Seleccionar...</option>
                {Object.keys(LURO_CATS).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Subcategoría</label>
              <select className="input text-sm" value={form.subcategoria}
                onChange={e => setForm(f => ({ ...f, subcategoria: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {subCats.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Detalle</label>
              <input type="text" placeholder="Descripción del gasto..." className="input text-sm" value={form.detail}
                onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Importe $ *</label>
              <input type="number" placeholder="0,00" className="input text-sm text-right" value={form.amount} required
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} step="0.01" min="0" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Medio de pago</label>
              <select className="input text-sm" value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {MEDIOS_PAGO.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Pagado</label>
              <select className="input text-sm" value={form.pagado}
                onChange={e => setForm(f => ({ ...f, pagado: e.target.value }))}>
                <option value="NO">NO</option>
                <option value="SI">SI</option>
              </select>
            </div>
            <div className="col-span-2 md:col-span-3 flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => { setAdding(false); setForm(EMPTY_FORM) }} className="btn-ghost text-sm">Cancelar</button>
              <button type="submit" className="btn-primary text-sm">Guardar gasto</button>
            </div>
          </form>
        )}

        {/* Tabla de gastos */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-navy text-white">
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Fecha</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Categoría</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Subcategoría</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Detalle</th>
                  <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-widest">Importe $</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-widest">Medio</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-widest">Pagado</th>
                  <th className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="table-tr">
                    <td className="table-td text-xs">{e.expense_date ?? '—'}</td>
                    <td className="table-td text-xs font-medium">{e.categoria ?? '—'}</td>
                    <td className="table-td text-xs text-brand-muted">{e.subcategoria ?? '—'}</td>
                    <td className="table-td text-xs">{e.detail ?? '—'}</td>
                    <td className="table-td text-xs text-right font-semibold">{fmt$(parseFloat(e.amount))}</td>
                    <td className="table-td text-xs text-center text-brand-muted">{e.payment_method ?? '—'}</td>
                    <td className="table-td text-center">
                      <button onClick={() => togglePagado(e.id, e.pagado ?? 'NO')}
                        className={['badge cursor-pointer', e.pagado === 'SI' ? 'badge-green' : 'badge-red'].join(' ')}>
                        {e.pagado === 'SI' ? 'SI' : 'NO'}
                      </button>
                    </td>
                    <td className="table-td p-1">
                      <button onClick={async () => { await api.delete(`/expenses/luro/${e.id}`); load() }}
                        className="text-red-400 hover:text-red-600 transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan={8} className="table-td text-center text-brand-muted py-10 text-sm">
                    No hay gastos para {month} {year}
                  </td></tr>
                )}
                <tr className="bg-brand-off-white border-t-2 border-brand-border font-bold text-xs">
                  <td colSpan={4} className="table-td">TOTAL MES</td>
                  <td className="table-td text-right">{fmt$(totalMes)}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Panel resumen categorías ── */}
      <div className="w-56 shrink-0 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted px-1">Resumen {month}</p>
        <div className="card p-3 space-y-1.5">
          {Object.keys(LURO_CATS).map(cat => (
            <div key={cat} className="flex justify-between items-center gap-2">
              <span className="text-xs text-brand-muted truncate">{cat}</span>
              <span className={['text-xs font-bold tabular-nums', resumen[cat] ? 'text-brand-body' : 'text-brand-muted/40'].join(' ')}>
                {resumen[cat] ? fmt$(resumen[cat]) : '—'}
              </span>
            </div>
          ))}
          <div className="border-t border-brand-border pt-1.5 mt-1 flex justify-between">
            <span className="text-xs font-bold text-brand-body">TOTAL</span>
            <span className="text-xs font-bold text-brand-body">{fmt$(totalMes)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── LuroReporte (anual) ───────────────────────────────────────────────────────
function LuroReporte({ year }: { year: number }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

  useEffect(() => {
    setLoading(true)
    api.get<any[]>(`/expenses/luro/reporte/${year}`).then(data => {
      setRows(data)
      setLoading(false)
    })
  }, [year])

  // Agrupa por categoría para mostrar subtotales
  const byCategoria: Record<string, any[]> = {}
  for (const row of rows) {
    byCategoria[row.categoria] = byCategoria[row.categoria] || []
    byCategoria[row.categoria].push(row)
  }

  // Total por mes (columna de pie)
  const totalPorMes: Record<string, number> = {}
  for (const mes of MESES) {
    totalPorMes[mes] = rows.reduce((a, r) => a + (r.months[mes] || 0), 0)
  }
  const totalAnual = rows.reduce((a, r) => a + r.total, 0)

  if (loading) return <div className="text-brand-muted text-sm py-10 text-center">Cargando reporte...</div>

  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: '1100px' }}>
          <thead>
            <tr className="bg-navy text-white">
              <th className="px-3 py-3 text-left font-bold uppercase tracking-widest sticky left-0 bg-navy" style={{ minWidth: 180 }}>Categoría / Subcategoría</th>
              {MESES.map(m => (
                <th key={m} className="px-2 py-3 text-right font-bold uppercase tracking-widest" style={{ minWidth: 80 }}>
                  {m.slice(0,3)}
                </th>
              ))}
              <th className="px-3 py-3 text-right font-bold uppercase tracking-widest">TOTAL</th>
              <th className="px-3 py-3 text-right font-bold uppercase tracking-widest">%</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byCategoria).map(([cat, subs]) => {
              const catTotal = subs.reduce((a, r) => a + r.total, 0)
              const catByMes: Record<string, number> = {}
              for (const mes of MESES) catByMes[mes] = subs.reduce((a, r) => a + (r.months[mes] || 0), 0)
              const pct = totalAnual > 0 ? ((catTotal / totalAnual) * 100).toFixed(1) : '0.0'
              return (
                <>
                  {/* Fila categoría (bold) */}
                  <tr key={`cat-${cat}`} className="bg-brand-off-white border-t border-brand-border">
                    <td className="px-3 py-2 font-bold text-brand-body sticky left-0 bg-brand-off-white">{cat}</td>
                    {MESES.map(m => (
                      <td key={m} className="px-2 py-2 text-right font-semibold text-brand-body">
                        {catByMes[m] > 0 ? fmt$(catByMes[m]) : <span className="text-brand-muted/40">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-bold text-brand-body">{catTotal > 0 ? fmt$(catTotal) : '—'}</td>
                    <td className="px-3 py-2 text-right font-bold text-coral">{pct}%</td>
                  </tr>
                  {/* Filas subcategorías */}
                  {subs.map((row: any) => (
                    <tr key={`${cat}-${row.subcategoria}`} className="table-tr">
                      <td className="px-3 py-1.5 text-brand-muted pl-6 sticky left-0 bg-white">{row.subcategoria}</td>
                      {MESES.map(m => (
                        <td key={m} className="px-2 py-1.5 text-right text-brand-muted">
                          {row.months[m] > 0 ? fmt$(row.months[m]) : <span className="text-brand-muted/30">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right text-brand-body font-medium">{row.total > 0 ? fmt$(row.total) : '—'}</td>
                      <td className="px-3 py-1.5 text-right text-brand-muted">
                        {totalAnual > 0 ? ((row.total / totalAnual) * 100).toFixed(1) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </>
              )
            })}

            {/* Fila totales */}
            {rows.length > 0 && (
              <tr className="bg-navy text-white font-bold border-t-2 border-brand-border">
                <td className="px-3 py-3 sticky left-0 bg-navy">TOTAL GENERAL</td>
                {MESES.map(m => (
                  <td key={m} className="px-2 py-3 text-right">
                    {totalPorMes[m] > 0 ? fmt$(totalPorMes[m]) : '—'}
                  </td>
                ))}
                <td className="px-3 py-3 text-right">{fmt$(totalAnual)}</td>
                <td className="px-3 py-3 text-right">100%</td>
              </tr>
            )}

            {rows.length === 0 && (
              <tr><td colSpan={15} className="table-td text-center text-brand-muted py-10">
                No hay datos para {year}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
