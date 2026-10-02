import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import {
  ShoppingCart, Plus, FileDown, Search, X, Pencil, Trash2, Eye,
  CheckCircle2, Clock, DollarSign, ArrowLeftRight, Users, Tags, LayoutGrid,
} from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'

/* ── Tipos ─────────────────────────────────────────────────────── */
interface Transfer {
  id: number; sale_id: number; sale_number: string; customer_name: string
  category_name: string; sale_total: number; sale_status: string
  date: string | null; amount: number; type: string
  reconciliation_status: string; reconciled_at: string | null; reconciled_by: string
}
interface Sale {
  id: number; sale_number: string; date: string | null
  customer_id: number | null; customer_name: string; contact: string
  category_id: number | null; category_name: string; description: string
  total: number; payment_status: string; amount_paid: number; amount_pending: number
  payment_method: string; cash_amount: number; transfer_amount: number
  sena_amount: number; sena_method: string
  created_by: string; updated_by: string; transfers: Transfer[]
}
interface Customer { id: number; name: string; phone: string; notes: string; active: boolean; created_at: string | null }
interface Category { id: number; name: string; active: boolean }

type Tab = 'resumen' | 'nueva' | 'ventas' | 'transferencias' | 'clientes' | 'categorias'

/* ── Helpers ───────────────────────────────────────────────────── */
const fmt$ = (n: number | null | undefined) =>
  n == null ? '$ 0' : `$ ${Math.round(Number(n)).toLocaleString('es-AR')}`
const fmtFecha = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}
const ESTADOS: Record<string, { label: string; bg: string; fg: string }> = {
  pendiente: { label: 'Pendiente', bg: '#fef3c7', fg: '#92400e' },
  senado:    { label: 'Señado',    bg: '#dbeafe', fg: '#1e40af' },
  pagado:    { label: 'Pagado',    bg: '#dcfce7', fg: '#166534' },
}
function Badge({ status }: { status: string }) {
  const e = ESTADOS[status] || { label: status, bg: '#eee', fg: '#555' }
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: e.bg, color: e.fg }}>{e.label}</span>
}

/* Input de dinero: guarda número, muestra $ formateado */
function MoneyInput({ value, onChange, placeholder, className, autoFocus }: {
  value: number; onChange: (n: number) => void; placeholder?: string; className?: string; autoFocus?: boolean
}) {
  const [foc, setFoc] = useState(false)
  const [txt, setTxt] = useState(value ? String(value) : '')
  useEffect(() => { if (!foc) setTxt(value ? String(value) : '') }, [value, foc])
  return (
    <input autoFocus={autoFocus} inputMode="numeric" placeholder={placeholder || '$ 0'}
      className={className}
      value={foc ? txt : (value ? `$ ${Number(value).toLocaleString('es-AR')}` : '')}
      onFocus={() => { setFoc(true); setTxt(value ? String(value) : '') }}
      onBlur={() => setFoc(false)}
      onChange={e => { const n = e.target.value.replace(/[^\d]/g, ''); setTxt(n); onChange(n ? parseInt(n) : 0) }} />
  )
}

const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
const lbl = "text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1"

/* ═══════════════════════════════════════════════════════════════ */
export default function VentaOnline() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'resumen'
  const setTab = (t: Tab) => setParams(t === 'resumen' ? {} : { tab: t })

  const TABS: [Tab, string, any][] = [
    ['resumen', 'Resumen', LayoutGrid],
    ['nueva', 'Nueva venta', Plus],
    ['ventas', 'Ventas', ShoppingCart],
    ['transferencias', 'Transferencias', ArrowLeftRight],
    ['clientes', 'Clientes', Users],
    ['categorias', 'Categorías', Tags],
  ]

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <div className="rounded-2xl p-6 mb-4" style={{ background: NAVY }}>
        <p className="text-[11px] font-bold tracking-[3px] uppercase mb-1" style={{ color: CORAL }}>Sur Maderas · ERP</p>
        <h1 className="text-3xl font-bold text-white">Venta Online</h1>
        <p className="text-white/50 text-sm">Registro comercial y control de cobranzas</p>
      </div>

      <div className="flex flex-wrap gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-lg transition-all ${tab === t ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            style={tab === t ? { color: NAVY } : {}}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'resumen'        && <TabResumen onNueva={() => setTab('nueva')} />}
      {tab === 'nueva'          && <SaleForm onDone={() => setTab('ventas')} />}
      {tab === 'ventas'         && <TabVentas />}
      {tab === 'transferencias' && <TabTransferencias />}
      {tab === 'clientes'       && <TabClientes />}
      {tab === 'categorias'     && <TabCategorias />}
    </div>
  )
}

/* ── RESUMEN ────────────────────────────────────────────────────── */
function TabResumen({ onNueva }: { onNueva: () => void }) {
  const [s, setS] = useState<any>(null)
  useEffect(() => { api.get('/online/summary').then(setS).catch(() => setS(null)) }, [])
  const card = (label: string, value: string, Icon: any, color = NAVY) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} style={{ color }} />
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
  return (
    <div>
      <button onClick={onNueva} className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold mb-4" style={{ background: CORAL }}>
        <Plus size={16} /> Nueva venta
      </button>
      {!s ? <p className="text-center py-12 text-gray-400 text-sm">Cargando…</p> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {card('Ventas de hoy', String(s.ventas_hoy), ShoppingCart, CORAL)}
          {card('Monto vendido hoy', fmt$(s.monto_hoy), DollarSign, CORAL)}
          {card('Pendientes', String(s.cant_pendientes), Clock, '#92400e')}
          {card('Señadas', String(s.cant_senadas), Clock, '#1e40af')}
          {card('Pagadas', String(s.cant_pagadas), CheckCircle2, '#166534')}
          {card('Transferencias hoy', fmt$(s.transfer_hoy), ArrowLeftRight, NAVY)}
          {card('Señas recibidas hoy', fmt$(s.senas_hoy), DollarSign, NAVY)}
        </div>
      )}
    </div>
  )
}

/* ── FORMULARIO NUEVA / EDITAR VENTA ───────────────────────────── */
function SaleForm({ sale, onDone, onCancel }: { sale?: Sale; onDone: () => void; onCancel?: () => void }) {
  const { user } = useAuth()
  const usuario = user?.username || 'Sistema'
  const editando = !!sale

  const [cats, setCats] = useState<Category[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  useEffect(() => {
    api.get<Category[]>('/online/categories?only_active=true').then(setCats).catch(() => setCats([]))
    api.get<Customer[]>('/online/customers?only_active=true').then(setCustomers).catch(() => setCustomers([]))
  }, [])

  const [fecha, setFecha] = useState(sale?.date?.slice(0, 10) || new Date().toISOString().slice(0, 10))
  const [custId, setCustId] = useState<number | null>(sale?.customer_id ?? null)
  const [custName, setCustName] = useState(sale?.customer_name || '')
  const [contact, setContact] = useState(sale?.contact || '')
  const [catId, setCatId] = useState<number | ''>(sale?.category_id ?? '')
  const [desc, setDesc] = useState(sale?.description || '')
  const [total, setTotal] = useState(sale?.total || 0)
  const [estado, setEstado] = useState(sale?.payment_status || 'pendiente')
  const [senaAmount, setSenaAmount] = useState(sale?.sena_amount || 0)
  const [senaMethod, setSenaMethod] = useState(sale?.sena_method || 'transferencia')
  const [payMethod, setPayMethod] = useState(sale?.payment_method || 'efectivo')
  const [cashAmount, setCashAmount] = useState(sale?.cash_amount || 0)
  const [transferAmount, setTransferAmount] = useState(sale?.transfer_amount || 0)
  const [saving, setSaving] = useState(false)
  const [custOpen, setCustOpen] = useState(false)

  const matches = useMemo(() =>
    custName.trim() ? customers.filter(c => c.name.toLowerCase().includes(custName.toLowerCase())).slice(0, 6) : customers.slice(0, 6),
    [custName, customers])

  const saldo = estado === 'pendiente' ? total : estado === 'senado' ? Math.max(0, total - senaAmount) : 0
  const mixtoSuma = cashAmount + transferAmount

  const pickCustomer = (c: Customer) => { setCustId(c.id); setCustName(c.name); if (c.phone) setContact(c.phone); setCustOpen(false) }

  const validar = (): string | null => {
    if (!total || total <= 0) return 'Ingresá un monto total mayor a 0.'
    if (estado === 'senado') {
      if (!senaAmount || senaAmount <= 0) return 'Ingresá la seña.'
      if (senaAmount > total) return 'La seña no puede superar el total.'
    }
    if (estado === 'pagado') {
      if (payMethod === 'transferencia' && (transferAmount <= 0 || transferAmount > total)) return 'El monto transferido no puede superar el total.'
      if (payMethod === 'mixto' && mixtoSuma !== total) return 'Efectivo + transferencia debe ser igual al total.'
    }
    return null
  }

  const guardar = async () => {
    const err = validar()
    if (err) { alert(err); return }
    setSaving(true)
    try {
      let finalCustId = custId
      // Auto-crear cliente nuevo si se escribió un nombre y no se eligió uno existente
      if (!finalCustId && custName.trim()) {
        const match = customers.find(c => c.name.toLowerCase() === custName.trim().toLowerCase())
        if (match) finalCustId = match.id
        else {
          const nuevo = await api.post<Customer>('/online/customers', { name: custName.trim(), phone: contact, notes: '', active: true })
          finalCustId = nuevo.id
        }
      }
      const payload: any = {
        date: fecha, customer_id: finalCustId, customer_name: custName.trim(), contact,
        category_id: catId || null, description: desc, total, payment_status: estado, usuario,
      }
      if (estado === 'senado') { payload.sena_amount = senaAmount; payload.sena_method = senaMethod }
      if (estado === 'pagado') {
        payload.payment_method = payMethod
        if (payMethod === 'transferencia') payload.transfer_amount = transferAmount || total
        if (payMethod === 'mixto') { payload.cash_amount = cashAmount; payload.transfer_amount = transferAmount }
      }
      if (editando) await api.put(`/online/sales/${sale!.id}`, payload)
      else          await api.post('/online/sales', payload)
      onDone()
    } catch (e: any) { alert('Error: ' + (e?.message || e)) }
    finally { setSaving(false) }
  }

  const estadoBtn = (val: string, label: string) => (
    <button type="button" onClick={() => setEstado(val)}
      className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
      style={estado === val
        ? { background: ESTADOS[val].bg, borderColor: ESTADOS[val].fg, color: ESTADOS[val].fg }
        : { background: '#fff', borderColor: '#eee', color: '#9ca3af' }}>
      {label}
    </button>
  )
  const subBtn = (cur: string, set: (v: string) => void, val: string, label: string) => (
    <button type="button" onClick={() => set(val)}
      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${cur === val ? 'text-white' : 'bg-white text-gray-400 border-gray-200'}`}
      style={cur === val ? { background: CORAL, borderColor: CORAL } : {}}>{label}</button>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg" style={{ color: NAVY }}>{editando ? `Editar ${sale!.sale_number}` : 'Nueva venta'}</h3>
        {onCancel && <button onClick={onCancel} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Fecha</label>
            <input type="date" className={inp} value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Contacto (WhatsApp)</label>
            <input className={inp} value={contact} onChange={e => setContact(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        {/* Cliente con autocompletar */}
        <div className="relative">
          <label className={lbl}>Cliente</label>
          <input className={inp} value={custName}
            onChange={e => { setCustName(e.target.value); setCustId(null); setCustOpen(true) }}
            onFocus={() => setCustOpen(true)}
            onBlur={() => setTimeout(() => setCustOpen(false), 150)}
            placeholder="Buscar o escribir nombre…" />
          {custId && <span className="absolute right-3 top-8 text-[10px] font-bold text-green-600">✓ existente</span>}
          {!custId && custName.trim() && <span className="absolute right-3 top-8 text-[10px] text-gray-400">se creará nuevo</span>}
          {custOpen && matches.length > 0 && (
            <div className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
              {matches.map(c => (
                <button key={c.id} type="button" onMouseDown={() => pickCustomer(c)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between">
                  <span className="font-semibold text-gray-700">{c.name}</span>
                  <span className="text-gray-400 text-xs">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Categoría</label>
            <select className={inp} value={catId} onChange={e => setCatId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Seleccionar —</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Monto total *</label>
            <MoneyInput value={total} onChange={setTotal} className={`${inp} font-bold`} />
          </div>
        </div>

        <div>
          <label className={lbl}>Descripción / detalle</label>
          <input className={inp} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Mesa ratona 80 x 50" />
        </div>

        {/* Estado de cobro */}
        <div>
          <label className={lbl}>Estado de cobro</label>
          <div className="flex gap-2">
            {estadoBtn('pendiente', 'Pendiente')}
            {estadoBtn('senado', 'Señado')}
            {estadoBtn('pagado', 'Pagado')}
          </div>
        </div>

        {/* Campos condicionales */}
        {estado === 'senado' && (
          <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Monto de la seña *</label>
                <MoneyInput value={senaAmount} onChange={setSenaAmount} className={inp} />
              </div>
              <div>
                <label className={lbl}>Medio de la seña</label>
                <div className="flex gap-2">
                  {subBtn(senaMethod, setSenaMethod, 'transferencia', 'Transferencia')}
                  {subBtn(senaMethod, setSenaMethod, 'efectivo', 'Efectivo')}
                </div>
              </div>
            </div>
            <div className="flex justify-between text-sm px-1">
              <span className="text-gray-500">Saldo pendiente:</span>
              <span className="font-bold" style={{ color: CORAL }}>{fmt$(saldo)}</span>
            </div>
            {senaMethod === 'transferencia' && <p className="text-[11px] text-blue-600 px-1">↪ Se registrará automáticamente en Transferencias.</p>}
          </div>
        )}

        {estado === 'pagado' && (
          <div className="rounded-xl bg-green-50/50 border border-green-100 p-3 space-y-3">
            <div>
              <label className={lbl}>Forma de pago</label>
              <div className="flex gap-2">
                {subBtn(payMethod, setPayMethod, 'efectivo', 'Efectivo')}
                {subBtn(payMethod, setPayMethod, 'transferencia', 'Transferencia')}
                {subBtn(payMethod, setPayMethod, 'mixto', 'Mixto')}
              </div>
            </div>
            {payMethod === 'transferencia' && (
              <div>
                <label className={lbl}>Monto transferido</label>
                <MoneyInput value={transferAmount || total} onChange={setTransferAmount} className={inp} />
              </div>
            )}
            {payMethod === 'mixto' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Efectivo</label><MoneyInput value={cashAmount} onChange={setCashAmount} className={inp} /></div>
                  <div><label className={lbl}>Transferencia</label><MoneyInput value={transferAmount} onChange={setTransferAmount} className={inp} /></div>
                </div>
                <div className="flex justify-between text-sm px-1">
                  <span className="text-gray-500">Suma:</span>
                  <span className="font-bold" style={{ color: mixtoSuma === total ? '#166534' : '#dc2626' }}>
                    {fmt$(mixtoSuma)} / {fmt$(total)}
                  </span>
                </div>
              </>
            )}
            {(payMethod === 'transferencia' || payMethod === 'mixto') && <p className="text-[11px] text-green-700 px-1">↪ La parte transferida se registrará en Transferencias.</p>}
          </div>
        )}

        <button onClick={guardar} disabled={saving}
          className="w-full text-white py-3 rounded-xl font-bold disabled:opacity-50 mt-1" style={{ background: NAVY }}>
          {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar venta'}
        </button>
      </div>
    </div>
  )
}

/* ── VENTAS (listado) ──────────────────────────────────────────── */
function TabVentas() {
  const [sales, setSales] = useState<Sale[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [fEstado, setFEstado] = useState('')
  const [fCat, setFCat] = useState('')
  const [fRango, setFRango] = useState('mes')
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')
  const [search, setSearch] = useState('')
  const [editSale, setEditSale] = useState<Sale | null>(null)
  const [viewSale, setViewSale] = useState<Sale | null>(null)

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams()
    if (fEstado) p.set('status', fEstado)
    if (fCat) p.set('category_id', fCat)
    if (search.trim()) p.set('search', search.trim())
    const today = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    if (fRango === 'hoy') { p.set('date_from', iso(today)); p.set('date_to', iso(today)) }
    else if (fRango === 'mes') { p.set('date_from', iso(new Date(today.getFullYear(), today.getMonth(), 1))); p.set('date_to', iso(today)) }
    else if (fRango === 'rango' && fDesde && fHasta) { p.set('date_from', fDesde); p.set('date_to', fHasta) }
    return p.toString()
  }, [fEstado, fCat, search, fRango, fDesde, fHasta])

  const load = useCallback(() => {
    setLoading(true)
    api.get<Sale[]>(`/online/sales?${buildQuery()}`).then(setSales).catch(() => setSales([])).finally(() => setLoading(false))
  }, [buildQuery])
  useEffect(() => { load() }, [load])
  useEffect(() => { api.get<Category[]>('/online/categories').then(setCats).catch(() => setCats([])) }, [])

  const eliminar = async (s: Sale) => {
    if (!confirm(`¿Eliminar la venta ${s.sale_number}? Se eliminarán también sus transferencias asociadas.`)) return
    await api.delete(`/online/sales/${s.id}`); load()
  }

  if (editSale) return <SaleForm sale={editSale} onDone={() => { setEditSale(null); load() }} onCancel={() => setEditSale(null)} />

  const totalVendido = sales.reduce((a, s) => a + s.total, 0)
  const totalCobrado = sales.reduce((a, s) => a + s.amount_paid, 0)
  const totalPend = sales.reduce((a, s) => a + s.amount_pending, 0)

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={15} className="text-gray-300" />
          <input className="flex-1 text-sm outline-none" placeholder="Buscar cliente o N° de venta…" value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={fRango} onChange={e => setFRango(e.target.value)}>
          <option value="hoy">Hoy</option>
          <option value="mes">Este mes</option>
          <option value="rango">Rango…</option>
          <option value="todos">Todos</option>
        </select>
        {fRango === 'rango' && (
          <>
            <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={fDesde} onChange={e => setFDesde(e.target.value)} />
            <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={fHasta} onChange={e => setFHasta(e.target.value)} />
          </>
        )}
        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={fEstado} onChange={e => setFEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="senado">Señado</option>
          <option value="pagado">Pagado</option>
        </select>
        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={fCat} onChange={e => setFCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => pdfDiario(sales)} className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{ background: CORAL }}>
          <FileDown size={13} /> PDF
        </button>
        <PdfMensualBtn />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-50">
                {['N°', 'Fecha', 'Cliente', 'Categoría', 'Descripción', 'Total', 'Cobrado', 'Pendiente', 'Estado', 'Pago', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={11} className="text-center py-10 text-gray-400">Cargando…</td></tr>}
              {!loading && sales.length === 0 && <tr><td colSpan={11} className="text-center py-10 text-gray-300">Sin ventas en este filtro.</td></tr>}
              {sales.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500">{s.sale_number}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{fmtFecha(s.date)}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-700">{s.customer_name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{s.category_name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[160px] truncate">{s.description || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt$(s.total)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{fmt$(s.amount_paid)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: s.amount_pending > 0 ? CORAL : '#cbd5e1' }}>{fmt$(s.amount_pending)}</td>
                  <td className="px-3 py-2.5"><Badge status={s.payment_status} /></td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 capitalize">{s.payment_method || (s.sena_method ? `seña ${s.sena_method}` : '—')}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewSale(s)} className="text-gray-300 hover:text-gray-700 p-1" title="Ver"><Eye size={14} /></button>
                      <button onClick={() => setEditSale(s)} className="text-gray-300 hover:text-gray-700 p-1" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => eliminar(s)} className="text-red-300 hover:text-red-600 p-1" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {sales.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-100 font-bold text-xs" style={{ color: NAVY }}>
                  <td className="px-3 py-2.5" colSpan={5}>TOTALES ({sales.length})</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt$(totalVendido)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{fmt$(totalCobrado)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: CORAL }}>{fmt$(totalPend)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {viewSale && <SaleView sale={viewSale} onClose={() => setViewSale(null)} />}
    </div>
  )
}

function SaleView({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const row = (k: string, v: string) => <div className="flex justify-between py-1.5 border-b border-gray-50 text-sm"><span className="text-gray-400">{k}</span><span className="font-semibold text-gray-700">{v}</span></div>
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg" style={{ color: NAVY }}>{sale.sale_number}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
        </div>
        {row('Fecha', fmtFecha(sale.date))}
        {row('Cliente', sale.customer_name || '—')}
        {row('Contacto', sale.contact || '—')}
        {row('Categoría', sale.category_name || '—')}
        {row('Descripción', sale.description || '—')}
        {row('Total', fmt$(sale.total))}
        {row('Cobrado', fmt$(sale.amount_paid))}
        {row('Pendiente', fmt$(sale.amount_pending))}
        {row('Estado', ESTADOS[sale.payment_status]?.label || sale.payment_status)}
        {sale.transfers.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase text-gray-400 mb-1">Transferencias</p>
            {sale.transfers.map(t => (
              <div key={t.id} className="flex justify-between text-sm py-1">
                <span className="text-gray-500 capitalize">{t.type} · {fmtFecha(t.date)}</span>
                <span className="font-semibold">{fmt$(t.amount)} <span className="text-[10px] text-gray-400">{t.reconciliation_status === 'controlada' ? '✓' : ''}</span></span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-gray-300 mt-3">Creó: {sale.created_by || '—'}{sale.updated_by ? ` · Editó: ${sale.updated_by}` : ''}</p>
      </div>
    </div>
  )
}

/* ── TRANSFERENCIAS ────────────────────────────────────────────── */
function TabTransferencias() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const load = () => {
    setLoading(true)
    const q = filtro ? `?reconciliation_status=${filtro}` : ''
    api.get<Transfer[]>(`/online/transfers${q}`).then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [filtro])

  const controlar = async (t: Transfer) => {
    await api.put(`/online/transfers/${t.id}/reconcile`, { usuario: user?.username || '' }); load()
  }
  const descontrolar = async (t: Transfer) => {
    await api.put(`/online/transfers/${t.id}/unreconcile`, {}); load()
  }
  const totalPend = rows.filter(r => r.reconciliation_status === 'pendiente').reduce((a, r) => a + r.amount, 0)

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs text-amber-700">
        Control interno de transferencias. <b>No</b> genera ingresos en Caja Diaria (se evita duplicar). Pendiente de controlar: <b>{fmt$(totalPend)}</b>
      </div>
      <div className="flex gap-2">
        {[['', 'Todas'], ['pendiente', 'Pendientes de controlar'], ['controlada', 'Controladas']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${filtro === v ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
            style={filtro === v ? { background: CORAL } : {}}>{l}</button>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-50">
                {['Fecha', 'N° Venta', 'Cliente', 'Categoría', 'Total venta', 'Tipo', 'Importe', 'Estado venta', 'Control', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={10} className="text-center py-10 text-gray-400">Cargando…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={10} className="text-center py-10 text-gray-300">Sin transferencias.</td></tr>}
              {rows.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500">{fmtFecha(t.date)}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500">{t.sale_number}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-700">{t.customer_name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{t.category_name || '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{fmt$(t.sale_total)}</td>
                  <td className="px-3 py-2.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.type === 'sena' ? '#dbeafe' : '#dcfce7', color: t.type === 'sena' ? '#1e40af' : '#166534' }}>{t.type === 'sena' ? 'Seña' : 'Pago'}</span></td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt$(t.amount)}</td>
                  <td className="px-3 py-2.5"><Badge status={t.sale_status} /></td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.reconciliation_status === 'controlada' ? '#dcfce7' : '#fee2e2', color: t.reconciliation_status === 'controlada' ? '#166534' : '#b91c1c' }}>
                      {t.reconciliation_status === 'controlada' ? 'Controlada' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {t.reconciliation_status === 'pendiente'
                      ? <button onClick={() => controlar(t)} className="text-[10px] font-semibold text-green-700 border border-green-200 rounded px-2 py-1 hover:bg-green-50">Marcar controlada</button>
                      : <button onClick={() => descontrolar(t)} className="text-[10px] text-gray-400 hover:text-gray-600">Deshacer</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── CLIENTES ──────────────────────────────────────────────────── */
function TabClientes() {
  const [rows, setRows] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [tel, setTel] = useState('')
  const [notas, setNotas] = useState('')
  const [detalle, setDetalle] = useState<any>(null)

  const load = () => { setLoading(true); api.get<Customer[]>('/online/customers').then(setRows).catch(() => setRows([])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const agregar = async () => {
    if (!nombre.trim()) { alert('Ingresá el nombre.'); return }
    await api.post('/online/customers', { name: nombre.trim(), phone: tel, notes: notas, active: true })
    setNombre(''); setTel(''); setNotas(''); load()
  }
  const toggleActivo = async (c: Customer) => { await api.put(`/online/customers/${c.id}`, { ...c, active: !c.active }); load() }
  const verDetalle = async (c: Customer) => { setDetalle(await api.get(`/online/customers/${c.id}`)) }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-wrap gap-2">
        <input className={`${inp} flex-1 min-w-[160px]`} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre / Razón social" />
        <input className={`${inp} w-40`} value={tel} onChange={e => setTel(e.target.value)} placeholder="Teléfono / WhatsApp" />
        <input className={`${inp} flex-1 min-w-[140px]`} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones" />
        <button onClick={agregar} className="text-white px-4 rounded-lg text-sm font-semibold" style={{ background: CORAL }}><Plus size={16} /></button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {loading && <p className="text-center py-10 text-gray-400 text-sm">Cargando…</p>}
        {!loading && rows.length === 0 && <p className="text-center py-10 text-gray-300 text-sm">Sin clientes.</p>}
        {rows.map(c => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <button onClick={() => verDetalle(c)} className="text-left flex-1">
              <p className="text-sm font-semibold text-gray-700">{c.name} {!c.active && <span className="text-[10px] text-gray-300">(inactivo)</span>}</p>
              <p className="text-xs text-gray-400">{c.phone || 'Sin teléfono'}{c.notes ? ` · ${c.notes}` : ''}</p>
            </button>
            <button onClick={() => toggleActivo(c)} className="text-[10px] text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">
              {c.active ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
      {detalle && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg" style={{ color: NAVY }}>{detalle.name}</h3>
              <button onClick={() => setDetalle(null)} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-[10px] text-gray-400 uppercase">Compras</p><p className="text-xl font-bold" style={{ color: NAVY }}>{detalle.cantidad_compras}</p></div>
              <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-[10px] text-gray-400 uppercase">Total</p><p className="text-lg font-bold" style={{ color: CORAL }}>{fmt$(detalle.total_comprado)}</p></div>
              <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-[10px] text-gray-400 uppercase">Última</p><p className="text-sm font-bold text-gray-600">{fmtFecha(detalle.ultima_compra)}</p></div>
            </div>
            <p className="text-[11px] font-bold uppercase text-gray-400 mb-1">Historial</p>
            <div className="divide-y divide-gray-50">
              {detalle.historial.length === 0 && <p className="text-xs text-gray-300 py-3">Sin compras.</p>}
              {detalle.historial.map((s: Sale) => (
                <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-500">{s.sale_number} · {fmtFecha(s.date)} <span className="text-gray-300">{s.category_name}</span></span>
                  <span className="font-semibold">{fmt$(s.total)} <Badge status={s.payment_status} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── CATEGORÍAS ────────────────────────────────────────────────── */
function TabCategorias() {
  const [rows, setRows] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [nueva, setNueva] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const load = () => { setLoading(true); api.get<Category[]>('/online/categories').then(setRows).catch(() => setRows([])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const agregar = async () => { if (!nueva.trim()) return; await api.post('/online/categories', { name: nueva.trim(), active: true }); setNueva(''); load() }
  const toggle = async (c: Category) => { await api.put(`/online/categories/${c.id}`, { name: c.name, active: !c.active }); load() }
  const guardarNombre = async (c: Category) => { await api.put(`/online/categories/${c.id}`, { name: editName.trim() || c.name, active: c.active }); setEditId(null); load() }

  return (
    <div className="space-y-3 max-w-xl">
      <div className="bg-white rounded-xl border border-gray-100 p-3 flex gap-2">
        <input className={`${inp} flex-1`} value={nueva} onChange={e => setNueva(e.target.value)} placeholder="Nueva categoría" onKeyDown={e => e.key === 'Enter' && agregar()} />
        <button onClick={agregar} className="text-white px-4 rounded-lg text-sm font-semibold" style={{ background: CORAL }}><Plus size={16} /></button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {loading && <p className="text-center py-10 text-gray-400 text-sm">Cargando…</p>}
        {rows.map(c => (
          <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
            {editId === c.id
              ? <input autoFocus className={`${inp} flex-1 mr-2`} value={editName} onChange={e => setEditName(e.target.value)}
                  onBlur={() => guardarNombre(c)} onKeyDown={e => e.key === 'Enter' && guardarNombre(c)} />
              : <button onClick={() => { setEditId(c.id); setEditName(c.name) }} className="text-left flex-1 text-sm font-semibold text-gray-700">
                  {c.name} {!c.active && <span className="text-[10px] text-gray-300">(inactiva)</span>}
                </button>}
            <button onClick={() => toggle(c)} className="text-[10px] text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">
              {c.active ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400">Las categorías con ventas no se eliminan; desactivalas para que no aparezcan en nuevas ventas (el historial se conserva).</p>
    </div>
  )
}

/* ── PDF mensual (selector) ────────────────────────────────────── */
function PdfMensualBtn() {
  const [open, setOpen] = useState(false)
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const gen = async () => {
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-${new Date(anio, mes, 0).getDate()}`
    const sales = await api.get<Sale[]>(`/online/sales?date_from=${desde}&date_to=${hasta}`).catch(() => [])
    pdfMensual(sales, mes, anio); setOpen(false)
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-xs font-semibold border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
        <FileDown size={13} /> PDF mensual
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-20 flex gap-2 items-end">
          <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={mes} onChange={e => setMes(Number(e.target.value))}>
            {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-20" value={anio} onChange={e => setAnio(Number(e.target.value))} />
          <button onClick={gen} className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: CORAL }}>Generar</button>
        </div>
      )}
    </div>
  )
}

/* ── Generación de PDF (cliente) ───────────────────────────────── */
function pdfMoney(n: number) { return `$ ${Math.round(n).toLocaleString('es-AR')}` }
function pdfHeader(subtitulo: string) {
  return `<div class="hdr">
    <div><div class="brand">SUR MADERAS</div><div class="sub">Ventas Online · ${subtitulo}</div></div>
  </div>`
}
function pdfStyles() {
  return `<style>
    @page { size: A4; margin: 1.2cm; }
    *{box-sizing:border-box} html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;font-size:9pt;margin:0}
    .hdr{display:flex;justify-content:space-between;align-items:center;background:${NAVY};border-radius:12px;padding:12px 18px;margin-bottom:12px}
    .brand{color:#fff;font-size:16pt;font-weight:800;letter-spacing:1px}
    .sub{color:rgba(255,255,255,.6);font-size:8.5pt;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th{background:${CORAL};color:#fff;font-size:8pt;text-transform:uppercase;padding:5px 7px;text-align:left}
    td{padding:4px 7px;font-size:8.5pt;border-bottom:1px solid #eee}
    tr:nth-child(even) td{background:#faf7f5}
    .r{text-align:right;font-variant-numeric:tabular-nums}
    .resumen{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
    .rcard{border:1px solid #eee;border-radius:8px;padding:8px 14px}
    .rlbl{font-size:7.5pt;color:#888;text-transform:uppercase}
    .rval{font-size:12pt;font-weight:700;color:${NAVY}}
  </style>`
}
function salesRows(sales: Sale[]) {
  return sales.map(s => `<tr>
    <td>${s.sale_number}</td><td>${s.customer_name || '—'}</td><td>${s.category_name || '—'}</td>
    <td class="r">${pdfMoney(s.total)}</td><td class="r">${pdfMoney(s.amount_paid)}</td>
    <td class="r">${pdfMoney(s.amount_pending)}</td>
    <td>${ESTADOS[s.payment_status]?.label || s.payment_status}</td>
    <td>${s.payment_method || (s.sena_method ? 'seña ' + s.sena_method : '—')}</td>
  </tr>`).join('')
}
function totales(sales: Sale[]) {
  const vendido = sales.reduce((a, s) => a + s.total, 0)
  const cobrado = sales.reduce((a, s) => a + s.amount_paid, 0)
  const pend = sales.reduce((a, s) => a + s.amount_pending, 0)
  const transfer = sales.reduce((a, s) => a + s.transfer_amount, 0)
  const efectivo = sales.reduce((a, s) => a + s.cash_amount, 0)
  const senas = sales.filter(s => s.payment_status === 'senado').reduce((a, s) => a + s.sena_amount, 0)
  return { vendido, cobrado, pend, transfer, efectivo, senas, cant: sales.length }
}
function openPdf(html: string, title: string) {
  const w = window.open('', '_blank', 'width=980,height=760')
  if (w) { w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${pdfStyles()}</head><body>${html}<script>window.onload=function(){window.print()}<\/script></body></html>`); w.document.close() }
}
function resumenCards(t: any) {
  return `<div class="resumen">
    <div class="rcard"><div class="rlbl">Ventas</div><div class="rval">${t.cant}</div></div>
    <div class="rcard"><div class="rlbl">Total vendido</div><div class="rval">${pdfMoney(t.vendido)}</div></div>
    <div class="rcard"><div class="rlbl">Total cobrado</div><div class="rval">${pdfMoney(t.cobrado)}</div></div>
    <div class="rcard"><div class="rlbl">Total pendiente</div><div class="rval">${pdfMoney(t.pend)}</div></div>
    <div class="rcard"><div class="rlbl">Transferencias</div><div class="rval">${pdfMoney(t.transfer)}</div></div>
    <div class="rcard"><div class="rlbl">Efectivo</div><div class="rval">${pdfMoney(t.efectivo)}</div></div>
    <div class="rcard"><div class="rlbl">Señas</div><div class="rval">${pdfMoney(t.senas)}</div></div>
  </div>`
}
function pdfDiario(sales: Sale[]) {
  if (sales.length === 0) { alert('No hay ventas para el PDF.'); return }
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
  const t = totales(sales)
  const html = `${pdfHeader(hoy)}
    <table><thead><tr><th>N°</th><th>Cliente</th><th>Categoría</th><th class="r">Total</th><th class="r">Cobrado</th><th class="r">Saldo</th><th>Estado</th><th>Pago</th></tr></thead>
    <tbody>${salesRows(sales)}</tbody></table>${resumenCards(t)}`
  openPdf(html, 'Ventas Online — Diario')
}
function pdfMensual(sales: Sale[], mes: number, anio: number) {
  const nombreMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes - 1]
  const t = totales(sales)
  // Ventas por categoría
  const porCat: Record<string, { cant: number; total: number }> = {}
  sales.forEach(s => { const k = s.category_name || 'Sin categoría'; porCat[k] = porCat[k] || { cant: 0, total: 0 }; porCat[k].cant++; porCat[k].total += s.total })
  const catRows = Object.entries(porCat).map(([k, v]) => `<tr><td>${k}</td><td class="r">${v.cant}</td><td class="r">${pdfMoney(v.total)}</td></tr>`).join('')
  const html = `${pdfHeader(`${nombreMes} ${anio}`)}
    ${resumenCards(t)}
    <h3 style="font-size:9pt;text-transform:uppercase;color:${CORAL};margin:14px 0 4px">Ventas por categoría</h3>
    <table><thead><tr><th>Categoría</th><th class="r">Cantidad</th><th class="r">Total vendido</th></tr></thead><tbody>${catRows}</tbody></table>
    <h3 style="font-size:9pt;text-transform:uppercase;color:${CORAL};margin:14px 0 4px">Detalle</h3>
    <table><thead><tr><th>N°</th><th>Cliente</th><th>Categoría</th><th class="r">Total</th><th class="r">Cobrado</th><th class="r">Saldo</th><th>Estado</th><th>Pago</th></tr></thead>
    <tbody>${salesRows(sales)}</tbody></table>`
  openPdf(html, `Ventas Online — ${nombreMes} ${anio}`)
}
