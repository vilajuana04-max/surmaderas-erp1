import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { can } from '../permissions'
import {
  ClipboardList, Plus, Camera, X, Search, MessageCircle, Send, CheckCircle2,
  Clock, Trash2, History, ImagePlus,
} from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'

/* ── Tipos ─────────────────────────────────────────────────────── */
interface Quote {
  id: number; quote_number: string; customer_name: string; phone: string; phone_normalized: string
  request_date: string | null; vendedor: string; materials: string; description: string
  status: string; status_label: string; quoted_amount: number | null
  estimated_lead_time: string; validity: string; created_by: string; assigned_to: string
  sent_at: string | null; sent_by: string; close_reason: string
  created_at: string | null; updated_at: string | null
  photo_count: number; thumb: string | null
  // full:
  orig_materials?: string; orig_description?: string; internal_notes?: string
  whatsapp_message?: string; suggested_message?: string
  attachments?: { id: number; data: string }[]
  history?: { id: number; actor: string; action: string; created_at: string | null }[]
}
interface Meta { vendedores: string[]; statuses: { key: string; label: string }[]; close_reasons: string[]; can_manage: boolean }

type Tab = 'nueva' | 'pendientes' | 'todos'

/* ── Helpers ───────────────────────────────────────────────────── */
const fmt$ = (n: number | null | undefined) => n == null ? '—' : `$ ${Math.round(Number(n)).toLocaleString('es-AR')}`
const fmtFecha = (iso: string | null) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y.slice(2)}` }
const fmtFechaHora = (iso: string | null) => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }
function relTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'hace minutos'
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'desde ayer'
  return `hace ${d} días`
}
function normalizeAR(raw: string): string {
  let d = (raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('54')) return d
  if (d.startsWith('0')) d = d.slice(1)
  const m = d.match(/^(\d{2,4})15(\d{6,8})$/)
  if (m) d = m[1] + m[2]
  return '549' + d
}
const ESTADOS: Record<string, { bg: string; fg: string }> = {
  pendiente: { bg: '#fef3c7', fg: '#92400e' },
  en_preparacion: { bg: '#dbeafe', fg: '#1e40af' },
  listo: { bg: '#e0e7ff', fg: '#3730a3' },
  enviado: { bg: '#ffedd5', fg: '#9a3412' },
  aceptado: { bg: '#dcfce7', fg: '#166534' },
  no_concretado: { bg: '#f1f1f1', fg: '#6b7280' },
}
function Badge({ q }: { q: Quote }) {
  const e = ESTADOS[q.status] || { bg: '#eee', fg: '#555' }
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: e.bg, color: e.fg }}>{q.status_label}</span>
}

/* Comprime una imagen a JPEG máx 1200px */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 1200
        let { width, height } = img
        if (width > max || height > max) {
          if (width >= height) { height = Math.round(height * max / width); width = max }
          else { width = Math.round(width * max / height); height = max }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const inp = "w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-gray-400"
const lbl = "text-sm font-bold text-gray-600 block mb-1.5"

/* ═══════════════════════════════════════════════════════════════ */
export default function Presupuestos() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const canManage = can(user?.permissions, 'presupuestos', 'edit')
  const tab = ((params.get('tab') as Tab) || 'nueva')
  const setTab = (t: Tab) => setParams(t === 'nueva' ? {} : { tab: t })

  const TABS: [Tab, string][] = [['nueva', 'Nueva carga'], ['pendientes', 'Pendientes'], ['todos', 'Todos']]

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="rounded-2xl p-6 mb-4" style={{ background: NAVY }}>
        <p className="text-[11px] font-bold tracking-[3px] uppercase mb-1" style={{ color: CORAL }}>Sur Maderas · ERP</p>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2"><ClipboardList size={26} /> Presupuestos</h1>
        <p className="text-white/50 text-sm">Solicitudes del salón y seguimiento</p>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
          {TABS.map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all ${tab === t ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              style={tab === t ? { color: NAVY } : {}}>{label}</button>
          ))}
        </div>
      )}

      {(tab === 'nueva' || !canManage) && <NuevaCarga />}
      {canManage && tab === 'pendientes' && <Pendientes />}
      {canManage && tab === 'todos' && <Todos />}
    </div>
  )
}

/* ── NUEVA CARGA (vendedor, mobile-first) ──────────────────────── */
function NuevaCarga() {
  const { user } = useAuth()
  const [meta, setMeta] = useState<Meta | null>(null)
  useEffect(() => { api.get<Meta>('/presupuestos/meta').then(setMeta).catch(() => setMeta(null)) }, [])

  const blank = { customer_name: '', phone: '', request_date: new Date().toISOString().slice(0, 10), vendedor: '', materials: '', description: '' }
  const [f, setF] = useState(blank)
  const [imgs, setImgs] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const addImages = async (files: FileList | null) => {
    if (!files) return
    const room = 3 - imgs.length
    const list = Array.from(files).slice(0, room)
    for (const file of list) {
      try { const data = await compressImage(file); setImgs(prev => prev.length < 3 ? [...prev, data] : prev) }
      catch { /* ignore */ }
    }
  }

  const guardar = async () => {
    if (!f.customer_name.trim()) { alert('Ingresá el nombre del cliente.'); return }
    if (!f.phone.trim()) { alert('Ingresá el teléfono.'); return }
    setSaving(true)
    try {
      await api.post('/presupuestos', {
        customer_name: f.customer_name.trim(), phone: f.phone.trim(),
        phone_normalized: normalizeAR(f.phone), request_date: f.request_date,
        vendedor: f.vendedor.trim() || user?.name || '', materials: f.materials, description: f.description,
        images: imgs,
      })
      setOk(true)
    } catch (e: any) { alert('Error: ' + (e?.message || e)) }
    finally { setSaving(false) }
  }

  const otro = () => { setF({ ...blank, vendedor: f.vendedor }); setImgs([]); setOk(false) }

  if (ok) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center max-w-md mx-auto">
      <CheckCircle2 size={48} className="mx-auto mb-3" style={{ color: '#16a34a' }} />
      <p className="text-lg font-bold text-gray-800">Solicitud guardada correctamente.</p>
      <p className="text-sm text-gray-400 mt-1">Administración la verá en Pendientes.</p>
      <button onClick={otro} className="mt-5 w-full text-white py-3.5 rounded-xl text-base font-bold" style={{ background: CORAL }}>
        <Plus size={18} className="inline mr-1" /> Cargar otro presupuesto
      </button>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 max-w-md mx-auto space-y-4">
      <div>
        <label className={lbl}>Nombre del cliente *</label>
        <input className={inp} value={f.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Ej: Juan Pérez" autoComplete="off" />
      </div>
      <div>
        <label className={lbl}>Teléfono / WhatsApp *</label>
        <input className={inp} value={f.phone} onChange={e => set('phone', e.target.value)} type="tel" inputMode="tel" placeholder="Ej: 223 15 1234567" />
        {f.phone.trim() && <p className="text-[11px] text-gray-400 mt-1">WhatsApp: +{normalizeAR(f.phone)}</p>}
      </div>
      <div>
        <label className={lbl}>Fecha</label>
        <input className={inp} type="date" value={f.request_date} onChange={e => set('request_date', e.target.value)} />
      </div>
      <div>
        <label className={lbl}>Material/es</label>
        <input className={inp} value={f.materials} onChange={e => set('materials', e.target.value)} placeholder="Ej: Melamina blanca 18 mm, correderas y canto" />
      </div>
      <div>
        <label className={lbl}>Detalles del pedido</label>
        <textarea className={inp} rows={3} value={f.description} onChange={e => set('description', e.target.value)}
          placeholder="Medidas, cantidad, terminaciones, colocación, tiempos o cualquier aclaración." />
      </div>

      {/* Fotos */}
      <div>
        <label className={lbl}>Fotos (hasta 3)</label>
        <div className="flex gap-2 flex-wrap">
          {imgs.map((src, i) => (
            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
              <img src={src} className="w-full h-full object-cover" />
              <button onClick={() => setImgs(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"><X size={12} /></button>
            </div>
          ))}
          {imgs.length < 3 && (
            <button onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1">
              <Camera size={20} /> <span className="text-[10px]">Agregar</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={e => { addImages(e.target.files); e.target.value = '' }} />
        <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1"><ImagePlus size={12} /> Se abre la cámara en el celular; o elegí una imagen existente.</p>
      </div>

      <div>
        <label className={lbl}>Vendedor que cargó</label>
        <input className={inp} list="vendedores-list" value={f.vendedor} onChange={e => set('vendedor', e.target.value)} placeholder="Elegí o escribí un nombre" />
        <datalist id="vendedores-list">
          {(meta?.vendedores || []).map(v => <option key={v} value={v} />)}
        </datalist>
      </div>

      <button onClick={guardar} disabled={saving}
        className="w-full text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50" style={{ background: NAVY }}>
        {saving ? 'Guardando…' : 'Guardar solicitud'}
      </button>
    </div>
  )
}

/* ── PENDIENTES (cards, más antiguo primero) ───────────────────── */
function Pendientes() {
  const [rows, setRows] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<number | null>(null)
  const load = () => { setLoading(true); api.get<Quote[]>('/presupuestos/pendientes').then(setRows).catch(() => setRows([])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  if (loading) return <p className="text-center py-12 text-gray-400 text-sm">Cargando…</p>
  if (rows.length === 0) return <p className="text-center py-12 text-gray-300 text-sm">No hay presupuestos pendientes. 🎉</p>
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(q => (
          <button key={q.id} onClick={() => setSel(q.id)} className="bg-white rounded-2xl border border-gray-100 p-4 text-left hover:border-gray-200 transition-all">
            <div className="flex items-start gap-3">
              {q.thumb
                ? <img src={q.thumb} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                : <div className="w-16 h-16 rounded-xl bg-gray-50 flex items-center justify-center text-gray-200 shrink-0"><Camera size={20} /></div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-gray-800 truncate">{q.customer_name}</p>
                  <Badge q={q} />
                </div>
                <p className="text-xs text-gray-500 truncate">{q.materials || 'Sin material'}</p>
                <p className="text-[11px] text-gray-400 mt-1">{q.vendedor || '—'} · {q.phone}</p>
                <p className="text-[11px] font-semibold mt-1" style={{ color: CORAL }}>
                  <Clock size={11} className="inline mr-0.5" /> {q.status === 'pendiente' ? 'Pendiente' : q.status_label} {relTime(q.created_at)}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
      {sel != null && <Detalle id={sel} onClose={() => setSel(null)} onChanged={load} />}
    </>
  )
}

/* ── TODOS (tabla + filtros) ───────────────────────────────────── */
function Todos() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [rows, setRows] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [fEstado, setFEstado] = useState('')
  const [fVend, setFVend] = useState('')
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (fEstado) p.set('status', fEstado)
    if (fVend) p.set('vendedor', fVend)
    if (search.trim()) p.set('search', search.trim())
    api.get<Quote[]>(`/presupuestos${p.toString() ? '?' + p.toString() : ''}`).then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }
  useEffect(() => { api.get<Meta>('/presupuestos/meta').then(setMeta).catch(() => setMeta(null)) }, [])
  useEffect(() => { load() }, [fEstado, fVend])

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search size={15} className="text-gray-300" />
          <input className="flex-1 text-sm outline-none" placeholder="Buscar cliente, teléfono o N°…" value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={fEstado} onChange={e => setFEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {meta?.statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={fVend} onChange={e => setFVend(e.target.value)}>
          <option value="">Todos los vendedores</option>
          {meta?.vendedores.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[780px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-50">
                {['N°', 'Fecha', 'Cliente', 'Teléfono', 'Vendedor', 'Monto', 'Estado', 'Actualizado'].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Cargando…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-gray-300">Sin presupuestos.</td></tr>}
              {rows.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSel(q.id)}>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500">{q.quote_number}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{fmtFecha(q.request_date)}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-700">{q.customer_name}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{q.phone}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{q.vendedor || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt$(q.quoted_amount)}</td>
                  <td className="px-3 py-2.5"><Badge q={q} /></td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{fmtFechaHora(q.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {sel != null && <Detalle id={sel} onClose={() => setSel(null)} onChanged={load} />}
    </div>
  )
}

/* ── DETALLE / GESTIÓN ─────────────────────────────────────────── */
function Detalle({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth()
  const isAdmin = can(user?.permissions, 'presupuestos', 'admin')
  const [q, setQ] = useState<Quote | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [monto, setMonto] = useState('')
  const [plazo, setPlazo] = useState('')
  const [validez, setValidez] = useState('')
  const [notas, setNotas] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [waOpened, setWaOpened] = useState(false)
  const [cierre, setCierre] = useState(false)
  const [motivo, setMotivo] = useState('')

  const load = () => {
    api.get<Quote>(`/presupuestos/${id}`).then(x => {
      setQ(x)
      setMonto(x.quoted_amount != null ? String(x.quoted_amount) : '')
      setPlazo(x.estimated_lead_time || ''); setValidez(x.validity || '')
      setNotas(x.internal_notes || '')
      setMsg(x.whatsapp_message || x.suggested_message || '')
    }).catch(() => setQ(null))
  }
  useEffect(() => { load(); api.get<Meta>('/presupuestos/meta').then(setMeta).catch(() => {}) }, [id])

  if (!q) return (
    <Overlay onClose={onClose}><div className="p-8 text-center text-gray-400">Cargando…</div></Overlay>
  )

  const guardar = async (regenMsg = false) => {
    setSaving(true)
    try {
      const body: any = {
        quoted_amount: monto ? parseFloat(monto) : null,
        estimated_lead_time: plazo, validity: validez, internal_notes: notas,
        whatsapp_message: msg,
      }
      const updated = await api.put<Quote>(`/presupuestos/${id}`, body)
      setQ(updated)
      if (regenMsg) setMsg(updated.suggested_message || msg)
      else setMsg(updated.whatsapp_message || msg)
      onChanged()
    } catch (e: any) { alert('Error: ' + (e?.message || e)) }
    finally { setSaving(false) }
  }

  const enviarWA = () => {
    const phone = q.phone_normalized || normalizeAR(q.phone)
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    setWaOpened(true)
  }

  const setStatus = async (status: string, close_reason = '') => {
    try { const u = await api.post<Quote>(`/presupuestos/${id}/status`, { status, close_reason }); setQ(u); onChanged(); setCierre(false); setWaOpened(false) }
    catch (e: any) { alert('Error: ' + (e?.message || e)) }
  }

  const eliminar = async () => {
    if (!confirm(`¿Eliminar ${q.quote_number}?`)) return
    try { await api.delete(`/presupuestos/${id}`); onChanged(); onClose() } catch (e: any) { alert(e?.message || e) }
  }

  const row = (k: string, v: string) => <div className="flex justify-between gap-3 py-1 text-sm"><span className="text-gray-400 shrink-0">{k}</span><span className="font-semibold text-gray-700 text-right">{v}</span></div>

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div>
          <h3 className="font-bold text-lg" style={{ color: NAVY }}>{q.quote_number} · {q.customer_name}</h3>
          <Badge q={q} />
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
      </div>

      <div className="p-5 space-y-4">
        {/* Solicitud original */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase text-gray-400 mb-1">Solicitud del vendedor</p>
          {row('Teléfono', q.phone)}
          {row('Fecha', fmtFecha(q.request_date))}
          {row('Vendedor', q.vendedor || '—')}
          {row('Material/es', q.orig_materials || q.materials || '—')}
          {q.orig_description && <div className="py-1"><p className="text-gray-400 text-sm">Detalles:</p><p className="text-sm text-gray-700">{q.orig_description}</p></div>}
          {(q.attachments && q.attachments.length > 0) && (
            <div className="flex gap-2 flex-wrap mt-2">
              {q.attachments.map(a => <a key={a.id} href={a.data} target="_blank" rel="noreferrer"><img src={a.data} className="w-20 h-20 rounded-lg object-cover border border-gray-200" /></a>)}
            </div>
          )}
        </div>

        {/* Presupuesto (admin) */}
        <div className="border border-gray-100 rounded-xl p-4 space-y-3">
          <p className="text-[11px] font-bold uppercase text-gray-400">Presupuesto</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-gray-500">Monto $</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold" type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="150000" /></div>
            <div><label className="text-xs font-semibold text-gray-500">Plazo estimado</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={plazo} onChange={e => setPlazo(e.target.value)} placeholder="7 a 10 días" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-gray-500">Validez</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={validez} onChange={e => setValidez(e.target.value)} placeholder="5 días" /></div>
          </div>
          <div><label className="text-xs font-semibold text-gray-500">Observaciones internas (no se envían)</label><textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} value={notas} onChange={e => setNotas(e.target.value)} /></div>
          <div className="flex gap-2">
            <button onClick={() => guardar(false)} disabled={saving} className="flex-1 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: NAVY }}>{saving ? 'Guardando…' : 'Guardar avances'}</button>
            <button onClick={() => guardar(true)} disabled={saving} className="px-3 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50" title="Regenerar mensaje con la plantilla">↻ Mensaje</button>
          </div>
        </div>

        {/* Mensaje WhatsApp */}
        <div className="border border-gray-100 rounded-xl p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase text-gray-400">Mensaje de WhatsApp (editable)</p>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={6} value={msg} onChange={e => setMsg(e.target.value)} />
          <button onClick={enviarWA} className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl text-sm font-bold" style={{ background: '#25D366' }}>
            <MessageCircle size={18} /> Enviar por WhatsApp
          </button>
          {waOpened && q.status !== 'enviado' && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
              <p className="text-sm text-amber-800 font-semibold mb-2">¿Ya enviaste el presupuesto?</p>
              <button onClick={() => setStatus('enviado')} className="w-full flex items-center justify-center gap-2 text-white py-2.5 rounded-lg text-sm font-bold" style={{ background: CORAL }}>
                <Send size={15} /> Marcar como enviado
              </button>
            </div>
          )}
        </div>

        {/* Cierre */}
        {(q.status === 'enviado' || q.status === 'listo') && (
          <div className="flex gap-2">
            <button onClick={() => setStatus('aceptado')} className="flex-1 text-white py-2.5 rounded-xl text-sm font-bold" style={{ background: '#16a34a' }}>✓ Marcar aceptado</button>
            <button onClick={() => setCierre(true)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">✕ No concretado</button>
          </div>
        )}
        {cierre && (
          <div className="border border-gray-100 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-600">Motivo (opcional)</p>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={motivo} onChange={e => setMotivo(e.target.value)}>
              <option value="">Sin especificar</option>
              {(meta?.close_reasons || []).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={() => setStatus('no_concretado', motivo)} className="w-full text-white py-2.5 rounded-xl text-sm font-bold" style={{ background: '#6b7280' }}>Confirmar no concretado</button>
          </div>
        )}

        {/* Historial */}
        {q.history && q.history.length > 0 && (
          <div className="border border-gray-100 rounded-xl p-4">
            <p className="text-[11px] font-bold uppercase text-gray-400 mb-2 flex items-center gap-1"><History size={13} /> Historial</p>
            {q.history.map(h => (
              <p key={h.id} className="text-xs text-gray-500 py-0.5">
                <span className="text-gray-400">{fmtFechaHora(h.created_at)}</span> — <b>{h.actor}</b> {h.action}
              </p>
            ))}
          </div>
        )}

        {isAdmin && <button onClick={eliminar} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={13} /> Eliminar presupuesto</button>}
      </div>
    </Overlay>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}
