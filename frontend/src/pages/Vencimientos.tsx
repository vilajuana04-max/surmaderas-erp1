import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Check, X, Edit2, Settings, Plus,
  Trash2, MessageCircle, MinusCircle, CheckCircle2, Calendar,
} from 'lucide-react'
import { api, MONTHS, CURRENT_YEAR, CURRENT_MONTH_IDX } from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────
type RecurringDue = {
  id: number
  name: string
  amount: number
  day_of_month: number
  category: string
  color: string
  active: boolean
  notes: string | null
  sort_order: number
}

type DueItem = {
  id: number
  name: string
  category: string
  color: string
  day: number
  amount: number
  status: 'pendiente' | 'pagado' | 'omitido'
  paid_at: string | null
  notes: string | null
  estado_id: number | null
  day_original: number
  amount_original: number
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const CATEGORIES = ['Alquiler','Servicios','Impuestos','Financiero','Seguros','Personal','Otros']

const CAT_COLORS: Record<string, string> = {
  Alquiler:   '#C8603A',
  Servicios:  '#3b82f6',
  Impuestos:  '#6366f1',
  Financiero: '#ef4444',
  Seguros:    '#8b5cf6',
  Personal:   '#22c55e',
  Otros:      '#64748b',
}

const COLOR_PALETTE = [
  '#C8603A','#3b82f6','#6366f1','#ef4444','#8b5cf6',
  '#22c55e','#f97316','#06b6d4','#eab308','#ec4899',
  '#64748b','#14b8a6',
]

const NAVY  = '#070614'
const CORAL = '#C8603A'

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n === 0) return '$ 0'
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── EditItemModal — ajustes del vencimiento para este mes ─────────────────────
function EditItemModal({
  item, month, year, onSave, onClose,
}: {
  item: DueItem
  month: string
  year: number
  onSave: () => void
  onClose: () => void
}) {
  const [day,    setDay]    = useState(item.day.toString())
  const [amount, setAmount] = useState(item.amount > 0 ? item.amount.toString() : '')
  const [notes,  setNotes]  = useState(item.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await api.put(`/vencimientos/${year}/${month}/${item.id}`, {
        status:          item.status,
        day_override:    day ? parseInt(day) : null,
        amount_override: amount ? parseFloat(amount.replace(/\./g, '').replace(',', '.')) : null,
        notes:           notes || null,
      })
      onSave()
      onClose()
    } catch {
      setError('Error al guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const monthLabel = MESES_ES[MONTHS.indexOf(month)]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{item.name}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Ajuste para {monthLabel} {year}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Día */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
              Día de vencimiento
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number" min={1} max={31}
                value={day}
                onChange={e => setDay(e.target.value)}
                className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {parseInt(day) !== item.day_original && (
                <button
                  onClick={() => setDay(item.day_original.toString())}
                  className="text-[11px] text-blue-500 hover:underline"
                >
                  ← Restaurar ({item.day_original})
                </button>
              )}
            </div>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
              Monto este mes
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                <input
                  type="text"
                  placeholder={
                    item.amount_original > 0
                      ? item.amount_original.toLocaleString('es-AR')
                      : '0'
                  }
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              {item.amount_original > 0 && amount !== '' &&
                parseFloat(amount.replace(/\./g, '').replace(',', '.')) !== item.amount_original && (
                <button
                  onClick={() => setAmount(item.amount_original.toString())}
                  className="text-[11px] text-blue-500 hover:underline whitespace-nowrap"
                >
                  ← Restaurar
                </button>
              )}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej: Pagado con tarjeta BBVA…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-xs mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm text-white font-bold disabled:opacity-60"
            style={{ background: NAVY }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SettingsModal — gestión de templates recurrentes ──────────────────────────
type FormState = {
  name: string; amount: string; day_of_month: string
  category: string; color: string; active: boolean; notes: string; sort_order: number
}

const EMPTY_FORM: FormState = {
  name: '', amount: '', day_of_month: '', category: 'Servicios',
  color: '#3b82f6', active: true, notes: '', sort_order: 0,
}

// IMPORTANTE: definido FUERA de SettingsModal para que React no lo desmonte en cada keystroke
function InlineForm({
  form, setF,
}: {
  form: FormState
  setF: (patch: Partial<FormState>) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
      {/* Nombre */}
      <div className="col-span-2">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Nombre</label>
        <input
          value={form.name}
          onChange={e => setF({ name: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Ej: Alquiler local"
        />
      </div>
      {/* Día */}
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Día del mes</label>
        <input
          type="number" min={1} max={31}
          value={form.day_of_month}
          onChange={e => setF({ day_of_month: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>
      {/* Monto */}
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Monto habitual</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">$</span>
          <input
            value={form.amount}
            onChange={e => setF({ amount: e.target.value })}
            className="w-full border border-gray-200 rounded-lg pl-6 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="0"
          />
        </div>
      </div>
      {/* Categoría */}
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Categoría</label>
        <select
          value={form.category}
          onChange={e => setF({ category: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      {/* Color */}
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Color</label>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {COLOR_PALETTE.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setF({ color: c })}
              className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: c, borderColor: form.color === c ? '#0f172a' : 'transparent' }}
            />
          ))}
        </div>
      </div>
      {/* Notas */}
      <div className="col-span-2">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Notas (opcional)</label>
        <input
          value={form.notes}
          onChange={e => setF({ notes: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Ej: Pagar antes del mediodía"
        />
      </div>
    </div>
  )
}

function SettingsModal({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const [templates, setTemplates] = useState<RecurringDue[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState<number | null>(null)
  const [addMode,   setAddMode]   = useState(false)
  const [deleteId,  setDeleteId]  = useState<number | null>(null)
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM)
  const setF = useCallback((patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch })), [])

  useEffect(() => {
    api.get<RecurringDue[]>('/vencimientos/recurring')
      .then(data => setTemplates(data))
      .catch(() => {/* silencio — tabla vacía hasta que el backend responda */})
      .finally(() => setLoading(false))
  }, [])

  async function toggleActive(t: RecurringDue) {
    await api.put(`/vencimientos/recurring/${t.id}`, { ...t, active: !t.active })
    setTemplates(ts => ts.map(x => x.id === t.id ? { ...x, active: !x.active } : x))
    onRefresh()
  }

  function startEdit(t: RecurringDue) {
    setEditId(t.id)
    setAddMode(false)
    setForm({
      name:         t.name,
      amount:       t.amount > 0 ? t.amount.toString() : '',
      day_of_month: t.day_of_month.toString(),
      category:     t.category,
      color:        t.color,
      active:       t.active,
      notes:        t.notes ?? '',
      sort_order:   t.sort_order,
    })
  }

  function buildPayload(extraActive?: boolean): Omit<RecurringDue, 'id' | 'created_at'> {
    return {
      name:         form.name.trim(),
      amount:       parseFloat(form.amount.replace(/\./g, '').replace(',', '.') || '0'),
      day_of_month: Math.min(31, Math.max(1, parseInt(form.day_of_month || '1'))),
      category:     form.category,
      color:        form.color,
      active:       extraActive ?? form.active,
      notes:        form.notes.trim() || null,
      sort_order:   form.sort_order,
    }
  }

  async function handleSaveEdit() {
    if (!editId) return
    const payload = buildPayload()
    await api.put(`/vencimientos/recurring/${editId}`, payload)
    setTemplates(ts => ts.map(x => x.id === editId ? { ...x, ...payload, id: editId } : x))
    setEditId(null)
    onRefresh()
  }

  async function handleAdd() {
    const payload = buildPayload(true)
    const result = await api.post<RecurringDue>('/vencimientos/recurring', {
      ...payload, sort_order: templates.length + 1,
    })
    setTemplates(ts => [...ts, result])
    setAddMode(false)
    setForm(EMPTY_FORM)
    onRefresh()
  }

  async function handleDelete(id: number) {
    await api.delete(`/vencimientos/recurring/${id}`)
    setTemplates(ts => ts.filter(x => x.id !== id))
    setDeleteId(null)
    onRefresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Vencimientos recurrentes</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Aparecen automáticamente todos los meses
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-2">
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Cargando…</p>
          ) : templates.map(t => (
            <div key={t.id}>
              {editId === t.id ? (
                <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/30">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-bold text-blue-700">Editando: {t.name}</p>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={13} />
                    </button>
                  </div>
                  <InlineForm form={form} setF={setF} />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setEditId(null)}
                      className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex-1 py-1.5 rounded-lg text-xs text-white font-bold"
                      style={{ background: NAVY }}
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                    t.active ? 'border-gray-100 bg-white hover:bg-gray-50/50' : 'border-gray-100 bg-gray-50 opacity-50'
                  }`}
                >
                  {/* Dot */}
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold text-gray-800 ${!t.active ? 'line-through' : ''}`}>
                        {t.name}
                      </span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                        día {t.day_of_month}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{t.category}</span>
                      {t.amount > 0 && (
                        <span className="text-[10px] text-gray-500 font-mono">{fmt(t.amount)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(t)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        t.active
                          ? 'text-green-600 bg-green-50 hover:bg-green-100'
                          : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                      }`}
                      title={t.active ? 'Desactivar' : 'Activar'}
                    >
                      {t.active ? <Check size={12} /> : <X size={12} />}
                    </button>
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={12} />
                    </button>
                    {deleteId === t.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => setDeleteId(null)}
                          className="px-2 py-1 rounded-lg text-[10px] text-gray-400 hover:bg-gray-100"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteId(t.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Agregar nuevo */}
          {addMode ? (
            <div className="border border-green-200 rounded-xl p-3 bg-green-50/30">
              <p className="text-[11px] font-bold text-green-700 mb-1">Nuevo vencimiento recurrente</p>
              <InlineForm form={form} setF={setF} />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setAddMode(false); setForm(EMPTY_FORM) }}
                  className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!form.name.trim() || !form.day_of_month}
                  className="flex-1 py-1.5 rounded-lg text-xs text-white font-bold disabled:opacity-50"
                  style={{ background: '#16a34a' }}
                >
                  Agregar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setAddMode(true); setEditId(null); setForm(EMPTY_FORM) }}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2 mt-2"
            >
              <Plus size={14} /> Agregar vencimiento
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Vencimientos() {
  const today = new Date()
  const [monthIdx,      setMonthIdx]      = useState(CURRENT_MONTH_IDX)
  const [year,          setYear]          = useState(CURRENT_YEAR)
  const [items,         setItems]         = useState<DueItem[]>([])
  const [loading,       setLoading]       = useState(false)
  const [showSettings,  setShowSettings]  = useState(false)
  const [editItem,      setEditItem]      = useState<DueItem | null>(null)

  const month          = MONTHS[monthIdx]
  const isCurrentMonth = monthIdx === today.getMonth() && year === today.getFullYear()
  const todayDay       = today.getDate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<DueItem[]>(`/vencimientos/${year}/${month}`)
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  // Cambiar estado rápido (pagar / deshacer / omitir)
  async function markStatus(item: DueItem, status: 'pendiente' | 'pagado' | 'omitido') {
    // Optimistic update
    setItems(its => its.map(i => i.id === item.id ? { ...i, status } : i))
    try {
      await api.put(`/vencimientos/${year}/${month}/${item.id}`, {
        status,
        day_override:    item.day !== item.day_original ? item.day : null,
        amount_override: item.amount !== item.amount_original ? item.amount : null,
        notes:           item.notes,
      })
    } catch {
      // Rollback on error
      setItems(its => its.map(i => i.id === item.id ? { ...i, status: item.status } : i))
    }
  }

  function prevMonth() {
    if (monthIdx === 0) { setMonthIdx(11); setYear(y => y - 1) }
    else setMonthIdx(m => m - 1)
  }
  function nextMonth() {
    if (monthIdx === 11) { setMonthIdx(0); setYear(y => y + 1) }
    else setMonthIdx(m => m + 1)
  }
  function goToday() {
    setMonthIdx(today.getMonth())
    setYear(today.getFullYear())
  }

  // ── Estadísticas ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activos   = items.filter(i => i.status !== 'omitido')
    const total     = activos.reduce((s, i) => s + i.amount, 0)
    const pagado    = items.filter(i => i.status === 'pagado').reduce((s, i) => s + i.amount, 0)
    const pendiente = items.filter(i => i.status === 'pendiente').reduce((s, i) => s + i.amount, 0)
    const vencidos  = isCurrentMonth
      ? items.filter(i => i.status === 'pendiente' && i.day < todayDay).length
      : 0
    return { total, pagado, pendiente, vencidos }
  }, [items, isCurrentMonth, todayDay])

  // ── Items para el mensaje de WhatsApp ────────────────────────────────────────
  const waItems = useMemo(() => {
    const pendientes = items.filter(i => i.status === 'pendiente')
    if (!isCurrentMonth) return pendientes
    // Esta semana: desde hoy hasta +6 días
    return pendientes.filter(i => i.day >= todayDay && i.day <= todayDay + 6)
  }, [items, isCurrentMonth, todayDay])

  function sendWhatsApp() {
    const semana = isCurrentMonth
      ? `semana ${todayDay}/${today.getMonth() + 1} – ${Math.min(todayDay + 6, 31)}/${today.getMonth() + 1}`
      : `${MESES_ES[monthIdx]} ${year}`

    const lines  = waItems.map(i =>
      `• Día ${i.day} · ${i.name}${i.amount > 0 ? ` · ${fmt(i.amount)}` : ''}`
    )
    const total  = waItems.reduce((s, i) => s + i.amount, 0)

    const text = [
      `🗓️ *Vencimientos ${semana} — Sur Maderas*`,
      '',
      waItems.length > 0
        ? `⏳ *Pendientes:*\n${lines.join('\n')}`
        : '✅ Sin vencimientos pendientes para esta semana.',
      total > 0 ? `\n💰 *Total: ${fmt(total)}*` : '',
      '',
      `_Sur Maderas ERP · ${MESES_ES[monthIdx]} ${year}_`,
    ].join('\n')

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  // ── Estado visual del día ────────────────────────────────────────────────────
  type DayStatus = 'today' | 'overdue' | 'soon' | 'future' | 'paid' | 'omitted'

  function getDayStatus(item: DueItem): DayStatus {
    if (item.status === 'pagado')  return 'paid'
    if (item.status === 'omitido') return 'omitted'
    if (!isCurrentMonth)           return 'future'
    if (item.day === todayDay)     return 'today'
    if (item.day < todayDay)       return 'overdue'
    if (item.day <= todayDay + 6)  return 'soon'
    return 'future'
  }

  const DAY_CHIP: Record<DayStatus, string> = {
    today:   'text-white font-bold',
    overdue: 'bg-red-100 text-red-600 font-bold',
    soon:    'bg-amber-100 text-amber-700 font-bold',
    future:  'bg-gray-100 text-gray-500',
    paid:    'bg-green-100 text-green-600',
    omitted: 'bg-gray-100 text-gray-300',
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-head, sans-serif)' }}>
            Calendario de Vencimientos
          </h1>
          <p className="text-gray-400 text-sm mt-1">Pagos recurrentes y vencimientos del mes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Settings size={14} />
            <span className="hidden sm:inline font-medium">Configurar</span>
          </button>

          <button
            onClick={sendWhatsApp}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white font-bold transition-opacity hover:opacity-90"
            style={{ background: '#25d366' }}
          >
            <MessageCircle size={14} />
            <span>Recordatorio WA</span>
            {waItems.length > 0 && (
              <span className="ml-0.5 bg-white/25 rounded-full text-[10px] font-bold w-[18px] h-[18px] flex items-center justify-center">
                {waItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Navegador de mes ── */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={prevMonth}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="text-center min-w-[180px]">
          <p className="text-xl font-bold text-gray-900">{MESES_ES[monthIdx]}</p>
          <p className="text-sm text-gray-400">{year}</p>
        </div>

        <button
          onClick={nextMonth}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronRight size={20} />
        </button>

        {!isCurrentMonth && (
          <button
            onClick={goToday}
            className="ml-1 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Hoy
          </button>
        )}
      </div>

      {/* ── Cards de resumen ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total del mes',
            value: fmt(stats.total),
            color: 'text-gray-900',
            bg:    'bg-white border-gray-100',
          },
          {
            label: 'Pagado',
            value: fmt(stats.pagado),
            color: 'text-green-600',
            bg:    'bg-green-50 border-green-100',
          },
          {
            label: 'Pendiente',
            value: fmt(stats.pendiente),
            color: 'text-blue-600',
            bg:    'bg-blue-50 border-blue-100',
          },
          {
            label: stats.vencidos > 0 ? '⚠ Vencidos' : 'Vencidos',
            value: stats.vencidos.toString(),
            color: stats.vencidos > 0 ? 'text-red-600' : 'text-gray-400',
            bg:    stats.vencidos > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100',
          },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4 border`}>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide font-bold">{label}</p>
            <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Lista de vencimientos ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

        {/* Barra de progreso del mes */}
        {stats.total > 0 && (
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
              <span>Progreso de pagos</span>
              <span>{Math.round((stats.pagado / stats.total) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width:      `${Math.min(100, (stats.pagado / stats.total) * 100)}%`,
                  background: '#16a34a',
                }}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Cargando vencimientos…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Calendar size={36} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Sin vencimientos configurados</p>
            <p className="text-gray-400 text-sm mt-1">
              Usá el botón "Configurar" para agregar tus pagos recurrentes.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: CORAL }}
            >
              Configurar ahora
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map(item => {
              const dayStatus = getDayStatus(item)
              const isPaid    = item.status === 'pagado'
              const isOmitted = item.status === 'omitido'

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition-colors group ${isOmitted ? 'opacity-40' : ''}`}
                >
                  {/* Chip del día */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm ${DAY_CHIP[dayStatus]}`}
                    style={dayStatus === 'today' ? { background: CORAL } : undefined}
                  >
                    {item.day}
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-sm font-semibold text-gray-800 ${isOmitted ? 'line-through' : ''}`}>
                        {item.name}
                      </span>
                      {dayStatus === 'today' && (
                        <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full uppercase" style={{ background: CORAL }}>
                          HOY
                        </span>
                      )}
                      {dayStatus === 'overdue' && (
                        <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full uppercase">
                          VENCIDO
                        </span>
                      )}
                      {dayStatus === 'soon' && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">
                          ESTA SEMANA
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {/* Categoría */}
                      <span
                        className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded uppercase tracking-wide"
                        style={{ background: (CAT_COLORS[item.category] ?? '#64748b') + 'dd' }}
                      >
                        {item.category}
                      </span>
                      {/* Monto */}
                      <span className="text-xs text-gray-600 font-mono">
                        {item.amount > 0 ? fmt(item.amount) : <span className="text-gray-300">— sin monto —</span>}
                      </span>
                      {/* Fecha de pago */}
                      {isPaid && item.paid_at && (
                        <span className="text-[10px] text-gray-400">
                          Pagado {new Date(item.paid_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      )}
                      {/* Notas */}
                      {item.notes && (
                        <span className="text-[10px] text-gray-400 italic truncate max-w-[140px]">{item.notes}</span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    {!isPaid && !isOmitted && (
                      <button
                        onClick={() => markStatus(item, 'pagado')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white transition-opacity hover:opacity-90"
                        style={{ background: '#16a34a' }}
                        title="Marcar como pagado"
                      >
                        <Check size={11} />
                        <span className="hidden sm:inline">Pagar</span>
                      </button>
                    )}
                    {isPaid && (
                      <button
                        onClick={() => markStatus(item, 'pendiente')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                        title="Deshacer pago"
                      >
                        <CheckCircle2 size={11} />
                        <span className="hidden sm:inline">Pagado</span>
                      </button>
                    )}
                    {isOmitted && (
                      <button
                        onClick={() => markStatus(item, 'pendiente')}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        Reactivar
                      </button>
                    )}

                    {/* Editar (ajuste mensual) */}
                    <button
                      onClick={() => setEditItem(item)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                      title="Ajustar para este mes"
                    >
                      <Edit2 size={13} />
                    </button>

                    {/* Omitir este mes */}
                    {!isOmitted && (
                      <button
                        onClick={() => markStatus(item, 'omitido')}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                        title="Omitir este mes"
                      >
                        <MinusCircle size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Leyenda */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: CORAL }} />
            Vence hoy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-200" />
            Vencido sin pagar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-200" />
            Esta semana
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-200" />
            Pagado
          </span>
          <span className="ml-auto">
            Hacé click en ✎ para ajustar monto o día para este mes puntual
          </span>
        </div>
      )}

      {/* ── Modals ── */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onRefresh={load}
        />
      )}
      {editItem && (
        <EditItemModal
          item={editItem}
          month={month}
          year={year}
          onSave={load}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  )
}
