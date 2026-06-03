import { useState, useEffect } from 'react'
import {
  Ticket, Search, CheckCircle, XCircle, Clock,
  Download, RefreshCw, Users, Star,
} from 'lucide-react'

const API   = import.meta.env.VITE_API_URL ?? ''
const NAVY  = '#070614'
const CORAL = '#C8603A'

// ── Diccionario de etiquetas (mismo que el sistema de encuestas) ──
const LABELS: Record<string, string> = {
  consumidor_final:           'Consumidor Final',
  monotributista:             'Monotributista',
  responsable_inscripto:      'Responsable Inscripto',
  exento:                     'Exento',
  madera:                     'Madera',
  tableros:                   'Tableros',
  herrajes:                   'Herrajes',
  servicio_corte:             'Servicio de corte',
  otro:                       'Otro',
  cortes_placas:              'Cortes a medida/placas',
  listoneria:                 'Listonería',
  molduras:                   'Molduras',
  marcos_portarretratos:      'Marcos y/o portarretratos',
  productos_muebles_estandar: 'Muebles estándar',
  proyecto_producto_medida:   'Proyecto a medida',
  productos_varios:           'Varios (cajas, baúles)',
  artistica:                  'Artística',
  lo_necesitaba_ya:           'Lo necesitaba ya',
  ya_los_conozco:             'Ya los conozco / recomendaron',
  me_asesoraron_bien:         'Me asesoraron bien',
  precio:                     'El precio',
  a_medida:                   'A medida',
  emprendimiento:             'Para emprendimiento',
  personal:                   'Para uso personal',
  seguro:                     'Seguro',
  probablemente:              'Probablemente',
  no_se:                      'No sé',
  luro:                       'Luro',
  independencia:              'Independencia',
}
const lbl = (k: string) => LABELS[k] || k || '-'

// ── Types ─────────────────────────────────────────────────────────
interface Encuesta {
  _id:               string
  createdAt:         string
  fullName?:         string
  taxIdType?:        string
  taxId?:            string
  phone?:            string
  email?:            string
  branch?:           string
  ivaCondition?:     string
  rating?:           number
  purchasedProducts?: string[]
  choiceReasons?:    string[]
  couponCode?:       string
  couponUsed?:       boolean
  couponUsedAt?:     string
  couponUsedBy?:     string
  couponExpiresAt?:  string
}

interface Summary {
  total:          number
  activeCoupons:  number
  usedCoupons:    number
  expiredCoupons: number
  averageRating:  number | null
}

type Filtro = 'todos' | 'activo' | 'usado' | 'vencido'

// ── Helpers ───────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

function isVencido(e: Encuesta) {
  return !!e.couponExpiresAt && new Date(e.couponExpiresAt).getTime() < Date.now()
}

function estadoCupon(e: Encuesta): { label: string; color: string; bg: string; icon: React.ReactNode } {
  if (e.couponUsed)  return { label: 'Usado',  color: '#DC2626', bg: '#FEF2F2', icon: <XCircle    size={12}/> }
  if (isVencido(e))  return { label: 'Vencido', color: '#9CA3AF', bg: '#F3F4F6', icon: <Clock      size={12}/> }
  return               { label: 'Activo',        color: '#16a34a', bg: '#F0FDF4', icon: <CheckCircle size={12}/> }
}

// ── Componente de búsqueda rápida (inline en la tabla) ────────────
function BusquedaRapida({ onValidar }: { onValidar: () => void }) {
  const [code,      setCode]      = useState('')
  const [cupon,     setCupon]     = useState<Encuesta | null>(null)
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null)
  const [searching, setSearching] = useState(false)
  const [validating,setValidating]= useState(false)

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c) return
    setSearching(true); setCupon(null); setMsg(null)
    try {
      const res = await fetch(`${API}/cupones/consultar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'omit', body: JSON.stringify({ couponCode: c }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'No encontrado')
      setCupon(data.coupon ?? data)
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : 'Error', ok: false })
    } finally { setSearching(false) }
  }

  const darDeBaja = async () => {
    if (!cupon?.couponCode) return
    if (!window.confirm(`¿Dar de baja el cupón ${cupon.couponCode}?`)) return
    setValidating(true); setMsg(null)
    try {
      const res = await fetch(`${API}/cupones/validar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'omit', body: JSON.stringify({ couponCode: cupon.couponCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error')
      setCupon(prev => prev ? { ...prev, couponUsed: true } : prev)
      setMsg({ text: '✓ Cupón dado de baja', ok: true })
      onValidar()
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : 'Error', ok: false })
    } finally { setValidating(false) }
  }

  const est = cupon ? estadoCupon(cupon) : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Ticket size={15} style={{ color: CORAL }} />
        <p className="font-bold text-sm text-gray-800">Validar cupón</p>
      </div>
      <form onSubmit={buscar} className="flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Código del cupón…"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono uppercase tracking-wider focus:outline-none focus:border-gray-400" />
        <button type="submit" disabled={searching || !code.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ background: NAVY }}>
          <Search size={13}/> {searching ? '…' : 'Buscar'}
        </button>
      </form>
      {msg && (
        <p className={`text-xs px-3 py-2 rounded-lg font-semibold ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </p>
      )}
      {cupon && est && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: est.color + '40' }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: est.bg }}>
            <span style={{ color: est.color }}>{est.icon}</span>
            <span className="text-xs font-bold" style={{ color: est.color }}>{est.label}</span>
            <span className="ml-auto font-mono text-xs text-gray-500 font-bold">{cupon.couponCode}</span>
          </div>
          <div className="px-3 py-2 space-y-1">
            {cupon.fullName && <p className="text-sm"><span className="text-gray-400">Cliente: </span><strong>{cupon.fullName}</strong></p>}
            {cupon.phone    && <p className="text-xs text-gray-500">{cupon.phone} · {cupon.email}</p>}
          </div>
          {!cupon.couponUsed && (
            <div className="px-3 pb-3">
              <button onClick={darDeBaja} disabled={validating}
                className="w-full py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: CORAL }}>
                {validating ? 'Procesando…' : '✓ Dar de baja'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────
export default function Cupones() {
  const [items,   setItems]   = useState<Encuesta[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro,  setFiltro]  = useState<Filtro>('todos')
  const [busq,    setBusq]    = useState('')
  const [downloading, setDownloading] = useState<'csv'|'excel'|null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/cupones/lista`, { credentials: 'omit' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setItems(Array.isArray(data.items) ? data.items : [])
      setSummary(data.summary ?? null)
    } catch { setItems([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // ── Filtros ──────────────────────────────────────────────────
  const filtered = items.filter(e => {
    if (filtro === 'activo'  && (e.couponUsed || isVencido(e))) return false
    if (filtro === 'usado'   && !e.couponUsed)                  return false
    if (filtro === 'vencido' && (!isVencido(e) || e.couponUsed)) return false
    if (busq) {
      const q = busq.toLowerCase()
      return (e.fullName?.toLowerCase().includes(q) || e.couponCode?.toLowerCase().includes(q) || e.phone?.includes(q) || e.email?.toLowerCase().includes(q))
    }
    return true
  })

  // ── Descarga ─────────────────────────────────────────────────
  const descargar = async (tipo: 'csv' | 'excel') => {
    setDownloading(tipo)
    try {
      const res = await fetch(`${API}/cupones/export/${tipo}`, { credentials: 'omit' })
      if (!res.ok) { alert('No se pudo descargar'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = tipo === 'csv' ? 'encuestas-sur-maderas.csv' : 'encuestas-sur-maderas.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally { setDownloading(null) }
  }

  const FILTROS: { key: Filtro; label: string; count: number; color: string }[] = [
    { key: 'todos',   label: 'Todos',   count: items.length,                                                          color: NAVY   },
    { key: 'activo',  label: 'Activos', count: summary?.activeCoupons  ?? items.filter(e => !e.couponUsed && !isVencido(e)).length, color: '#16a34a' },
    { key: 'usado',   label: 'Usados',  count: summary?.usedCoupons    ?? items.filter(e => !!e.couponUsed).length,                  color: '#DC2626' },
    { key: 'vencido', label: 'Vencidos',count: summary?.expiredCoupons ?? items.filter(e => isVencido(e) && !e.couponUsed).length,   color: '#9CA3AF' },
  ]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cupones 15% OFF</h1>
          <p className="text-gray-400 text-sm mt-0.5">Base de datos de encuestas y cupones de descuento</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => load()} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Actualizar
          </button>
          <button onClick={() => descargar('csv')} disabled={!!downloading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <Download size={14}/> {downloading === 'csv' ? 'Descargando…' : 'CSV'}
          </button>
          <button onClick={() => descargar('excel')} disabled={!!downloading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
            style={{ background: '#16a34a' }}>
            <Download size={14}/> {downloading === 'excel' ? 'Descargando…' : 'Excel'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Registros',  value: summary.total,          color: NAVY,      icon: <Users size={16}/> },
            { label: 'Activos',    value: summary.activeCoupons,   color: '#16a34a', icon: <CheckCircle size={16}/> },
            { label: 'Usados',     value: summary.usedCoupons,     color: '#DC2626', icon: <XCircle size={16}/> },
            { label: 'Vencidos',   value: summary.expiredCoupons,  color: '#9CA3AF', icon: <Clock size={16}/> },
            { label: 'Rating prom.',value: summary.averageRating != null ? `${summary.averageRating.toFixed(1)}/5` : '-', color: '#f59e0b', icon: <Star size={16}/> },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
                {icon}
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Layout: tabla + validador */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* ── Tabla principal ── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Filtros + búsqueda */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
              {FILTROS.map(f => (
                <button key={f.key} onClick={() => setFiltro(f.key)}
                  className="px-3 py-2 text-xs font-bold transition-all flex items-center gap-1"
                  style={filtro === f.key ? { background: f.color, color: 'white' } : { color: '#9CA3AF' }}>
                  {f.label}
                  <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                    style={filtro === f.key ? { background: 'rgba(255,255,255,0.25)' } : { background: '#F3F4F6', color: '#6B7280' }}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
            <input value={busq} onChange={e => setBusq(e.target.value)}
              placeholder="Buscar nombre, cupón, teléfono…"
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-white" />
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-400 text-sm">
              Cargando encuestas…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-400 text-sm">
              <Ticket size={32} strokeWidth={1} className="mx-auto mb-3 opacity-40"/>
              <p>Sin resultados</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: NAVY }}>
                      {['Fecha','Cliente','Contacto','Sucursal','IVA','Exp.','Qué compró','Cupón'].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-white/60 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(e => {
                      const est = estadoCupon(e)
                      return (
                        <tr key={e._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5 text-[11px] text-gray-400 whitespace-nowrap">{e.createdAt ? fmtDate(e.createdAt) : '-'}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-semibold text-gray-800 text-[12px]">{e.fullName || '-'}</p>
                            <p className="text-[10px] text-gray-400">{e.taxIdType ? `${lbl(e.taxIdType)} ${e.taxId ?? ''}` : ''}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="text-[12px] text-gray-700">{e.phone || '-'}</p>
                            <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{e.email || ''}</p>
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-600 whitespace-nowrap">{e.branch ? lbl(e.branch) : '-'}</td>
                          <td className="px-3 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">{e.ivaCondition ? lbl(e.ivaCondition) : '-'}</td>
                          <td className="px-3 py-2.5 text-[12px] font-semibold text-gray-700 whitespace-nowrap">
                            {e.rating ? `${e.rating}/5` : '-'}
                          </td>
                          <td className="px-3 py-2.5 max-w-[160px]">
                            <p className="text-[11px] text-gray-700 leading-tight">
                              {(e.purchasedProducts || []).map(lbl).join(', ') || '-'}
                            </p>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span style={{ color: est.color }}>{est.icon}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: est.color }}>{est.label}</span>
                            </div>
                            <p className="font-mono text-[11px] font-bold text-gray-700">{e.couponCode || '-'}</p>
                            {e.couponExpiresAt && (
                              <p className="text-[10px] text-gray-400">Vence: {fmtDate(e.couponExpiresAt)}</p>
                            )}
                            {e.couponUsed && e.couponUsedAt && (
                              <p className="text-[10px] text-gray-400">Usado: {fmtDate(e.couponUsedAt)}</p>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400">
                Mostrando {filtered.length} de {items.length} registros
              </div>
            </div>
          )}
        </div>

        {/* ── Panel validador lateral ── */}
        <div className="w-full lg:w-72 shrink-0">
          <BusquedaRapida onValidar={load} />
        </div>
      </div>
    </div>
  )
}
