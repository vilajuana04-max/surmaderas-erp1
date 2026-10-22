import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'

const NAVY  = '#070614'
const CORAL = '#C8603A'

interface Question { id: string; label: string; type: string; options?: string[]; required?: boolean }
interface Campaign { slug: string; name: string; discount_pct: number; scope_text: string; intro_text: string; questions: Question[]; active: boolean }

export default function CampaignForm() {
  const { slug } = useParams()
  const [camp, setCamp] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ coupon_code: string; discount_pct: number; scope_text: string; name: string } | null>(null)

  useEffect(() => {
    api.get<Campaign>(`/campaigns/public/${slug}`)
      .then(setCamp).catch(() => setNotFound(true)).finally(() => setLoading(false))
  }, [slug])

  const setAns = (id: string, v: any) => setAnswers((p) => ({ ...p, [id]: v }))

  const enviar = async () => {
    if (!name.trim()) { alert('Ingresá tu nombre.'); return }
    if (!phone.trim()) { alert('Ingresá tu teléfono.'); return }
    for (const q of camp?.questions || []) {
      if (q.required && !answers[q.id]) { alert(`Completá: ${q.label}`); return }
    }
    setSaving(true)
    try {
      const r = await api.post<any>(`/campaigns/public/${slug}/submit`, {
        customer_name: name.trim(), phone: phone.trim(), email: email.trim(), answers,
      })
      setResult(r)
    } catch (e: any) { alert('Error: ' + (e?.message || e)) }
    finally { setSaving(false) }
  }

  const copiar = async () => { if (result) { try { await navigator.clipboard.writeText(result.coupon_code); alert('Código copiado') } catch { /* */ } } }

  const inp = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-[#C8603A]'
  const lbl = 'text-sm font-bold text-gray-700 block mb-1.5'

  const wrap = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-start justify-center py-8 px-4" style={{ background: '#f3efec' }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl p-6 mb-4 text-center" style={{ background: NAVY }}>
          <p className="text-[11px] font-bold tracking-[4px] uppercase" style={{ color: CORAL }}>Sur Maderas</p>
          <p className="text-white/50 text-xs mt-1">Mar del Plata</p>
        </div>
        {children}
      </div>
    </div>
  )

  if (loading) return wrap(<p className="text-center py-12 text-gray-400">Cargando…</p>)
  if (notFound || !camp) return wrap(
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <p className="text-lg font-bold text-gray-700">Promo no disponible</p>
      <p className="text-sm text-gray-400 mt-1">Este enlace no está activo. Consultá en el local.</p>
    </div>
  )

  if (result) return wrap(
    <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
      <div className="text-5xl mb-2">🎉</div>
      <p className="text-lg font-bold" style={{ color: NAVY }}>¡Listo! Tu cupón</p>
      <p className="text-sm text-gray-500 mb-4">{result.discount_pct}% OFF {result.scope_text ? `· ${result.scope_text}` : ''}</p>
      <div className="rounded-2xl border-2 border-dashed p-5 mb-3" style={{ borderColor: CORAL }}>
        <p className="text-3xl font-black tracking-wider" style={{ color: CORAL }}>{result.coupon_code}</p>
      </div>
      <button onClick={copiar} className="w-full text-white py-3 rounded-xl font-bold" style={{ background: NAVY }}>Copiar código</button>
      <p className="text-xs text-gray-400 mt-3">Mostrá este código en la caja de Sur Maderas para usar tu descuento.</p>
    </div>
  )

  return wrap(
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{camp.name}</h1>
        {camp.discount_pct > 0 && <p className="text-sm font-bold" style={{ color: CORAL }}>{camp.discount_pct}% OFF {camp.scope_text ? `· ${camp.scope_text}` : ''}</p>}
        {camp.intro_text && <p className="text-sm text-gray-500 mt-2">{camp.intro_text}</p>}
      </div>

      <div><label className={lbl}>Nombre *</label><input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" /></div>
      <div><label className={lbl}>Teléfono / WhatsApp *</label><input className={inp} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 223 15 1234567" /></div>
      <div><label className={lbl}>Email (opcional)</label><input className={inp} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" /></div>

      {(camp.questions || []).map((q) => (
        <div key={q.id}>
          <label className={lbl}>{q.label}{q.required ? ' *' : ''}</label>
          {q.type === 'textarea' ? (
            <textarea className={inp} rows={3} value={answers[q.id] || ''} onChange={(e) => setAns(q.id, e.target.value)} />
          ) : q.type === 'select' ? (
            <select className={inp} value={answers[q.id] || ''} onChange={(e) => setAns(q.id, e.target.value)}>
              <option value="">Elegí…</option>
              {(q.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : q.type === 'rating' ? (
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setAns(q.id, n)}
                  className="text-3xl" style={{ opacity: (answers[q.id] || 0) >= n ? 1 : 0.3 }}>⭐</button>
              ))}
            </div>
          ) : (
            <input className={inp} value={answers[q.id] || ''} onChange={(e) => setAns(q.id, e.target.value)} />
          )}
        </div>
      ))}

      <button onClick={enviar} disabled={saving} className="w-full text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50" style={{ background: CORAL }}>
        {saving ? 'Enviando…' : 'Obtener mi cupón'}
      </button>
    </div>
  )
}
