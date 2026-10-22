import { useEffect, useState } from 'react'
import { api } from '../api'
import {
  Megaphone, Plus, X, Pencil, Trash2, QrCode, Copy, Users, Ticket, Search, Save,
} from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'

interface Question { id: string; label: string; type: string; options?: string[]; required?: boolean }
interface Campaign {
  id: number; slug: string; name: string; coupon_prefix: string; next_number: number
  discount_pct: number; scope_text: string; intro_text: string; questions: Question[]
  public_url: string; active: boolean; created_by: string; created_at: string | null; respuestas: number; canjeados: number
}
interface Resp {
  id: number; coupon_code: string; customer_name: string; phone: string; email: string
  answers: Record<string, any>; used: boolean; active: boolean; created_at: string | null
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400'
const lbl = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1'
const publicUrl = (slug: string) => `${window.location.origin}/c/${slug}`

export default function Campanias() {
  const [rows, setRows] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<Campaign | 'nuevo' | null>(null)
  const [respOf, setRespOf] = useState<Campaign | null>(null)
  const [qrOf, setQrOf] = useState<Campaign | null>(null)
  const [valQ, setValQ] = useState('')
  const [valRows, setValRows] = useState<(Resp & { campaign?: string; discount_pct?: number; scope_text?: string })[] | null>(null)
  const [valBusy, setValBusy] = useState(false)

  const load = () => { setLoading(true); api.get<Campaign[]>('/campaigns').then(setRows).catch(() => setRows([])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const validar = async () => {
    const q = valQ.trim()
    if (!q) return
    setValBusy(true)
    try { setValRows(await api.get<any[]>(`/campaigns/search?q=${encodeURIComponent(q)}`)) }
    catch { setValRows([]) }
    finally { setValBusy(false) }
  }
  const bajaResp = async (id: number) => { await api.post(`/campaigns/responses/${id}/toggle-active`, {}); validar(); load() }
  const usarResp = async (id: number) => { await api.post(`/campaigns/responses/${id}/toggle-used`, {}); validar(); load() }

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="rounded-2xl p-6 mb-4 flex items-center justify-between flex-wrap gap-3" style={{ background: NAVY }}>
        <div>
          <p className="text-[11px] font-bold tracking-[3px] uppercase mb-1" style={{ color: CORAL }}>Clientes</p>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2"><Megaphone size={26} /> Campañas de cupones</h1>
          <p className="text-white/50 text-sm">Formularios con QR que generan cupones (ej: Batata)</p>
        </div>
        <button onClick={() => setEditor('nuevo')} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-bold" style={{ background: CORAL }}><Plus size={16} /> Nueva campaña</button>
      </div>

      {/* Validador / buscador de cupones */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Search size={15} className="text-gray-300" />
          <input className="flex-1 min-w-[160px] text-sm outline-none" placeholder="Buscar por cupón o nombre (ej: SURBATATA111 o Juan)" value={valQ} onChange={(e) => setValQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && validar()} />
          <button onClick={validar} disabled={valBusy} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: NAVY }}>{valBusy ? '…' : 'Buscar'}</button>
          {valRows !== null && <button onClick={() => { setValRows(null); setValQ('') }} className="text-xs font-semibold text-gray-400 px-2 py-1.5">Limpiar</button>}
        </div>
        {valRows !== null && (
          <div className="mt-3 space-y-2">
            {valRows.length === 0 && <p className="text-xs text-gray-400 py-2">Sin resultados para "{valQ}".</p>}
            {valRows.map((r) => {
              const estilo = !r.active ? { bg: '#f1f1f1', col: '#6b7280', txt: 'De baja' }
                : r.used ? { bg: '#dbeafe', col: '#1e40af', txt: 'Canjeado' }
                : { bg: '#dcfce7', col: '#166534', txt: 'Vigente' }
              return (
                <div key={r.id} className="border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-base" style={{ color: CORAL }}>{r.coupon_code}</p>
                    <p className="text-sm font-semibold text-gray-700">{r.customer_name || '—'} <span className="text-gray-400 font-normal text-xs">{r.phone ? `· ${r.phone}` : ''}{r.email ? ` · ${r.email}` : ''}</span></p>
                    <p className="text-[11px] text-gray-400">{r.campaign}{r.discount_pct ? ` · ${r.discount_pct}% OFF` : ''}{r.scope_text ? ` · ${r.scope_text}` : ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: estilo.bg, color: estilo.col }}>{estilo.txt}</span>
                    <div className="flex gap-1">
                      <button onClick={() => usarResp(r.id)} className="text-[10px] font-semibold border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">{r.used ? 'Desmarcar' : 'Marcar usado'}</button>
                      <button onClick={() => bajaResp(r.id)} className="text-[10px] font-semibold border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">{r.active ? 'Dar de baja' : 'Reactivar'}</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {loading && <p className="text-center py-12 text-gray-400 text-sm">Cargando…</p>}
      {!loading && rows.length === 0 && <p className="text-center py-12 text-gray-300 text-sm">Todavía no hay campañas. Creá la primera (ej: Batata).</p>}

      <div className="grid md:grid-cols-2 gap-3">
        {rows.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-gray-800">{c.name} {!c.active && <span className="text-[10px] text-gray-300">(inactiva)</span>}</p>
                <p className="text-xs text-gray-400">Cupón: <span className="font-mono">{c.coupon_prefix}###</span> · {c.discount_pct}% OFF</p>
                {c.scope_text && <p className="text-[11px] text-gray-400">{c.scope_text}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setQrOf(c)} className="text-gray-300 hover:text-gray-700 p-1" title="QR / link"><QrCode size={15} /></button>
                <button onClick={() => setEditor(c)} className="text-gray-300 hover:text-gray-700 p-1" title="Editar"><Pencil size={15} /></button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 text-xs">
              <button onClick={() => setRespOf(c)} className="flex items-center gap-1 font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"><Users size={13} /> {c.respuestas} respuestas</button>
              <span className="flex items-center gap-1 text-gray-400"><Ticket size={13} /> {c.canjeados} canjeados</span>
            </div>
          </div>
        ))}
      </div>

      {editor && <Editor camp={editor === 'nuevo' ? null : editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load() }} onDeleted={() => { setEditor(null); load() }} />}
      {respOf && <Respuestas camp={respOf} onClose={() => setRespOf(null)} onChanged={load} />}
      {qrOf && <QrModal camp={qrOf} onClose={() => setQrOf(null)} />}
    </div>
  )
}

/* ── Editor de campaña ── */
let qseq = 0
function Editor({ camp, onClose, onSaved, onDeleted }: { camp: Campaign | null; onClose: () => void; onSaved: () => void; onDeleted: () => void }) {
  const editando = !!camp
  const [name, setName] = useState(camp?.name || '')
  const [slug, setSlug] = useState(camp?.slug || '')
  const [pubUrl, setPubUrl] = useState(camp?.public_url || '')
  const [prefix, setPrefix] = useState(camp?.coupon_prefix || 'SUR')
  const [nextNumber, setNextNumber] = useState(String(camp?.next_number ?? 1))
  const [discount, setDiscount] = useState(String(camp?.discount_pct ?? 15))
  const [scope, setScope] = useState(camp?.scope_text || '')
  const [intro, setIntro] = useState(camp?.intro_text || '')
  const [active, setActive] = useState(camp?.active ?? true)
  const [questions, setQuestions] = useState<Question[]>(camp?.questions || [])
  const [saving, setSaving] = useState(false)

  const addQ = () => setQuestions((p) => [...p, { id: `q${Date.now()}_${qseq++}`, label: '', type: 'text', required: false }])
  const setQ = (i: number, patch: Partial<Question>) => setQuestions((p) => p.map((q, idx) => idx === i ? { ...q, ...patch } : q))
  const delQ = (i: number) => setQuestions((p) => p.filter((_, idx) => idx !== i))

  const guardar = async () => {
    if (!name.trim()) { alert('Ingresá el nombre de la campaña.'); return }
    setSaving(true)
    try {
      const body = {
        name: name.trim(), slug: slug.trim() || undefined, public_url: pubUrl.trim(),
        coupon_prefix: prefix.trim().toUpperCase().replace(/\s/g, ''),
        next_number: parseInt(nextNumber) || 1, discount_pct: parseFloat(discount) || 0,
        scope_text: scope, intro_text: intro, active,
        questions: questions.filter((q) => q.label.trim()).map((q) => ({ ...q, options: q.type === 'select' ? (q.options || []) : undefined })),
      }
      if (editando) await api.put(`/campaigns/${camp!.id}`, body)
      else await api.post('/campaigns', body)
      onSaved()
    } catch (e: any) { alert('Error: ' + (e?.message || e)); setSaving(false) }
  }
  const eliminar = async () => {
    if (!editando) return
    if (!confirm(`¿Eliminar la campaña "${camp!.name}"?`)) return
    try { await api.delete(`/campaigns/${camp!.id}`); onDeleted() } catch (e: any) { alert(e?.message || e) }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <h3 className="font-bold text-lg" style={{ color: NAVY }}>{editando ? camp!.name : 'Nueva campaña'}</h3>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
      </div>
      <div className="p-5 space-y-3">
        <div><label className={lbl}>Nombre de la campaña *</label><input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Colaboración Batata" /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lbl}>Prefijo cupón</label><input className={inp} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="SURBATATA" /></div>
          <div><label className={lbl}>N° inicial</label><input className={inp} type="number" value={nextNumber} onChange={(e) => setNextNumber(e.target.value)} /></div>
          <div><label className={lbl}>% descuento</label><input className={inp} type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
        </div>
        <p className="text-[11px] text-gray-400 -mt-1">Ej: con prefijo <b>SURBATATA</b> y N° inicial <b>111</b> → los cupones serán SURBATATA111, SURBATATA112…</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Slug (identificador)</label><input className={inp} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="batataxsur" />
            <p className="text-[10px] text-gray-400 mt-0.5">Se usa en el formulario público. Ej: batataxsur</p></div>
          <div><label className={lbl}>URL pública (WordPress)</label><input className={inp} value={pubUrl} onChange={(e) => setPubUrl(e.target.value)} placeholder="https://surmaderas.com.ar/Batataxsur/" />
            <p className="text-[10px] text-gray-400 mt-0.5">A dónde apunta el QR (tu dominio real)</p></div>
        </div>
        <div><label className={lbl}>Alcance / condiciones (se muestra al cliente)</label><input className={inp} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Ej: línea infantil, todos los medios de pago" /></div>
        <div><label className={lbl}>Texto de bienvenida (opcional)</label><textarea className={inp} rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Completá para recibir tu cupón…" /></div>

        {/* Preguntas */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={lbl}>Preguntas del formulario</label>
            <button onClick={addQ} className="text-xs font-semibold" style={{ color: CORAL }}>+ Agregar pregunta</button>
          </div>
          <p className="text-[11px] text-gray-400 mb-2">Nombre, teléfono y email ya van incluidos siempre. Acá agregás las preguntas de la campaña.</p>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className="border border-gray-100 rounded-lg p-2.5 space-y-2">
                <div className="flex gap-2">
                  <input className={`${inp} flex-1`} value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} placeholder="Texto de la pregunta" />
                  <select className={`${inp} w-32`} value={q.type} onChange={(e) => setQ(i, { type: e.target.value })}>
                    <option value="text">Texto corto</option><option value="textarea">Texto largo</option>
                    <option value="select">Opciones</option><option value="rating">Estrellas</option>
                  </select>
                  <button onClick={() => delQ(i)} className="text-red-300 hover:text-red-600 px-1"><Trash2 size={15} /></button>
                </div>
                {q.type === 'select' && (
                  <input className={inp} value={(q.options || []).join(', ')} onChange={(e) => setQ(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Opciones separadas por coma" />
                )}
                <label className="flex items-center gap-1.5 text-xs text-gray-500"><input type="checkbox" checked={!!q.required} onChange={(e) => setQ(i, { required: e.target.checked })} /> Obligatoria</label>
              </div>
            ))}
          </div>
        </div>

        {editando && (
          <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Campaña activa (el formulario público funciona)</label>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={guardar} disabled={saving} className="flex-1 text-white py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: NAVY }}><Save size={16} /> {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear campaña'}</button>
          {editando && <button onClick={eliminar} className="px-4 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50">Eliminar</button>}
        </div>
      </div>
    </Overlay>
  )
}

/* ── Respuestas de una campaña ── */
function Respuestas({ camp, onClose, onChanged }: { camp: Campaign; onClose: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<Resp[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => { setLoading(true); api.get<Resp[]>(`/campaigns/${camp.id}/responses`).then(setRows).catch(() => setRows([])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [camp.id])
  const toggleUsed = async (r: Resp) => { await api.post(`/campaigns/responses/${r.id}/toggle-used`, {}); load(); onChanged() }
  const toggleActive = async (r: Resp) => { await api.post(`/campaigns/responses/${r.id}/toggle-active`, {}); load(); onChanged() }
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <h3 className="font-bold text-lg" style={{ color: NAVY }}>Respuestas · {camp.name}</h3>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
      </div>
      <div className="p-5">
        {loading && <p className="text-center py-6 text-gray-400 text-sm">Cargando…</p>}
        {!loading && rows.length === 0 && <p className="text-center py-6 text-gray-300 text-sm">Sin respuestas todavía.</p>}
        <div className="divide-y divide-gray-50">
          {rows.map((r) => (
            <div key={r.id} className={`py-3 ${!r.active ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-bold" style={{ color: CORAL }}>{r.coupon_code}</p>
                  <p className="text-sm font-semibold text-gray-700">{r.customer_name} <span className="text-gray-400 font-normal text-xs">· {r.phone}{r.email ? ` · ${r.email}` : ''}</span></p>
                  {Object.keys(r.answers || {}).length > 0 && <p className="text-xs text-gray-400 mt-0.5">{Object.values(r.answers).map((v) => String(v)).join(' · ')}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: !r.active ? '#f1f1f1' : r.used ? '#dbeafe' : '#dcfce7', color: !r.active ? '#6b7280' : r.used ? '#1e40af' : '#166534' }}>{!r.active ? 'De baja' : r.used ? 'Canjeado' : 'Vigente'}</span>
                  <div className="flex gap-1">
                    <button onClick={() => toggleUsed(r)} className="text-[10px] font-semibold border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">{r.used ? 'Desmarcar' : 'Marcar usado'}</button>
                    <button onClick={() => toggleActive(r)} className="text-[10px] font-semibold border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">{r.active ? 'Dar de baja' : 'Reactivar'}</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Overlay>
  )
}

/* ── QR + link ── */
function QrModal({ camp, onClose }: { camp: Campaign; onClose: () => void }) {
  const url = (camp.public_url || '').trim() || publicUrl(camp.slug)
  const copiar = async () => { try { await navigator.clipboard.writeText(url); alert('Link copiado') } catch { /* */ } }
  return (
    <Overlay onClose={onClose} narrow>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-bold text-lg" style={{ color: NAVY }}>QR · {camp.name}</h3>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
      </div>
      <div className="p-5 text-center">
        <img alt="QR" className="mx-auto rounded-xl border border-gray-100" width={220} height={220}
          src={`https://api.qrserver.com/v1/create-qr-code/?size=440x440&data=${encodeURIComponent(url)}`} />
        <p className="text-xs text-gray-400 mt-3 break-all">{url}</p>
        <button onClick={copiar} className="mt-3 w-full flex items-center justify-center gap-2 text-white py-2.5 rounded-xl font-bold" style={{ background: NAVY }}><Copy size={16} /> Copiar link</button>
        <p className="text-[11px] text-gray-400 mt-2">Imprimí el QR o compartí el link. Al escanearlo, el cliente completa el formulario y recibe su cupón.</p>
      </div>
    </Overlay>
  )
}

function Overlay({ children, onClose, narrow }: { children: React.ReactNode; onClose: () => void; narrow?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl w-full ${narrow ? 'max-w-xs' : 'max-w-lg'} max-h-[92vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}
