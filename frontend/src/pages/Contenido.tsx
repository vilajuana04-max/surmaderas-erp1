// Planificador de Contenido — Sur Maderas (Instagram / Facebook / WhatsApp Estado)
import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import {
  Instagram, Facebook, MessageCircle, Image as ImageIcon, Film, Layers, Square,
  Calendar as CalIcon, List, Grid3x3, ChevronLeft, ChevronRight, Plus, X, Trash2,
  Copy, Edit2, Check, Eye, Upload, AlertTriangle, Download, Clock, Mail,
} from 'lucide-react'

const NAVY  = '#0A0A0A'
const CORAL = '#C8603A'

// ── Redes ─────────────────────────────────────────────────────────
type Red = 'instagram_feed' | 'instagram_story' | 'facebook' | 'whatsapp_estado' | 'email_doppler'
const REDES: Record<Red, { label: string; corto: string; color: string; bg: string; icon: React.ReactNode }> = {
  instagram_feed:  { label: 'Instagram Feed',  corto: 'IG Feed',  color: '#DD2A7B', bg: 'linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)', icon: <Instagram size={12}/> },
  instagram_story: { label: 'Instagram Story', corto: 'IG Story', color: '#8134AF', bg: '#8134AF', icon: <Instagram size={12}/> },
  facebook:        { label: 'Facebook',        corto: 'Facebook', color: '#1877F2', bg: '#1877F2', icon: <Facebook size={12}/> },
  whatsapp_estado: { label: 'WhatsApp Estado', corto: 'WA Estado',color: '#25D366', bg: '#25D366', icon: <MessageCircle size={12}/> },
  email_doppler:   { label: 'Email (Doppler)', corto: 'Doppler',  color: '#0891B2', bg: '#0891B2', icon: <Mail size={12}/> },
}
const TIPOS: Record<string, { label: string; icon: React.ReactNode }> = {
  post_estatico: { label: 'Post estático', icon: <Square size={13}/> },
  reel:          { label: 'Reel',          icon: <Film size={13}/> },
  story:         { label: 'Story',         icon: <ImageIcon size={13}/> },
  carrusel:      { label: 'Carrusel',      icon: <Layers size={13}/> },
}
const ESTADO_COLOR: Record<string, string> = {
  borrador: '#888580', en_revision: '#E8A030', listo: '#2D5A8E', publicado: '#2D7A3A',
}
const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador', en_revision: 'En revisión', listo: 'Listo', publicado: 'Publicado',
}
const HORARIOS = 'Sugeridos · Instagram 12h y 19h · Facebook 13h y 20h · WhatsApp 8h y 19h'
const LIMITES: Record<Red, number> = { instagram_feed: 2200, instagram_story: 2200, facebook: 63206, whatsapp_estado: 700, email_doppler: 100000 }

interface Contenido {
  id: number
  titulo: string
  redes: Red[]
  tipo: string
  fecha_publicacion: string | null
  copy: string
  hashtags: string
  archivo_url: string
  archivo_tipo: string
  archivos: { url: string; tipo: string }[]
  estado: string
  campana_id: number | null
  notas_internas: string
}
interface Campana { id: number; titulo: string }

const DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function lunesDe(d: Date): Date {
  const x = new Date(d); const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x
}
function isoDia(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function fmtHora(iso: string | null) { return iso ? iso.slice(11, 16) : '' }

const EMPTY: Omit<Contenido, 'id'> = {
  titulo: '', redes: [], tipo: 'post_estatico', fecha_publicacion: null,
  copy: '', hashtags: '', archivo_url: '', archivo_tipo: '', archivos: [],
  estado: 'borrador', campana_id: null, notas_internas: '',
}

export default function Contenido() {
  const [items, setItems]   = useState<Contenido[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [vista, setVista]   = useState<'semana' | 'lista' | 'mes'>('semana')
  const [loading, setLoading] = useState(false)
  const [semana, setSemana] = useState(() => lunesDe(new Date()))
  const [modal, setModal]   = useState<{ ev: Partial<Contenido> } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, m] = await Promise.all([
        api.get<Contenido[]>('/contenido'),
        api.get<{ id: number; titulo: string; es_permanente: boolean }[]>('/marketing').catch(() => []),
      ])
      setItems(c)
      setCampanas((m as any[]).filter(x => !x.es_permanente).map(x => ({ id: x.id, titulo: x.titulo })))
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const nombreCampana = (id: number | null) => campanas.find(c => c.id === id)?.titulo

  // Contador semanal vs anterior
  const finSemana = useMemo(() => { const f = new Date(semana); f.setDate(f.getDate() + 7); return f }, [semana])
  const enRango = (iso: string | null, ini: Date, fin: Date) => {
    if (!iso) return false
    const f = new Date(iso); return f >= ini && f < fin
  }
  const countEsta = items.filter(i => enRango(i.fecha_publicacion, semana, finSemana)).length
  const semanaPrev = useMemo(() => { const x = new Date(semana); x.setDate(x.getDate() - 7); return x }, [semana])
  const countPrev = items.filter(i => enRango(i.fecha_publicacion, semanaPrev, semana)).length

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div style={{ background: NAVY }} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase mb-1">Sur Maderas · ERP</p>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><CalIcon size={22}/> Planificador de Contenido</h1>
          <p className="text-white/50 text-sm">
            {countEsta} esta semana · {countPrev} la anterior
            {countEsta > countPrev && <span className="text-green-400"> ↑</span>}
            {countEsta < countPrev && <span className="text-red-400"> ↓</span>}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex rounded-lg overflow-hidden border border-white/15">
            {([['semana', CalIcon, 'Semana'], ['lista', List, 'Lista'], ['mes', Grid3x3, 'Mes']] as const).map(([id, Icon, label]) => (
              <button key={id} onClick={() => setVista(id)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all"
                style={vista === id ? { background: CORAL, color: 'white' } : { color: 'rgba(255,255,255,.5)' }}>
                <Icon size={14}/> {label}
              </button>
            ))}
          </div>
          <button onClick={() => setModal({ ev: { ...EMPTY } })} style={{ background: CORAL }}
            className="flex items-center gap-2 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <Plus size={16}/> Nueva publicación
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-12 text-gray-400">Cargando…</div>}

      {!loading && vista === 'semana' && (
        <WeekView items={items} semana={semana} setSemana={setSemana}
          onNew={(iso) => setModal({ ev: { ...EMPTY, fecha_publicacion: iso } })}
          onEdit={(e) => setModal({ ev: { ...e } })} nombreCampana={nombreCampana} />
      )}
      {!loading && vista === 'lista' && (
        <ListView items={items} onEdit={(e) => setModal({ ev: { ...e } })} onReload={load} nombreCampana={nombreCampana} />
      )}
      {!loading && vista === 'mes' && (
        <MonthView items={items} onEdit={(e) => setModal({ ev: { ...e } })} />
      )}

      {modal && (
        <ContentModal ev={modal.ev} campanas={campanas}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
    </div>
  )
}

// Badges de redes
function RedBadges({ redes }: { redes: Red[] }) {
  return (
    <div className="flex gap-1">
      {redes.map(r => (
        <span key={r} title={REDES[r]?.label} className="w-4 h-4 rounded-full flex items-center justify-center text-white"
          style={{ background: REDES[r]?.bg }}>{REDES[r]?.icon}</span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// VISTA SEMANA
// ════════════════════════════════════════════════════════════════
function WeekView({ items, semana, setSemana, onNew, onEdit, nombreCampana }: {
  items: Contenido[]; semana: Date; setSemana: (d: Date) => void
  onNew: (iso: string) => void; onEdit: (e: Contenido) => void; nombreCampana: (id: number|null) => string|undefined
}) {
  const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(semana); d.setDate(d.getDate() + i); return d })
  const porDia: Record<string, Contenido[]> = {}
  items.forEach(i => {
    if (!i.fecha_publicacion) return
    const k = i.fecha_publicacion.slice(0, 10)
    ;(porDia[k] = porDia[k] || []).push(i)
  })
  Object.values(porDia).forEach(arr => arr.sort((a, b) => (a.fecha_publicacion! < b.fecha_publicacion! ? -1 : 1)))

  // Alerta de huecos: >4 días seguidos sin publicaciones en la semana
  let maxHueco = 0, hueco = 0
  dias.forEach(d => { if ((porDia[isoDia(d)] || []).length === 0) { hueco++; maxHueco = Math.max(maxHueco, hueco) } else hueco = 0 })

  const prev = () => { const x = new Date(semana); x.setDate(x.getDate() - 7); setSemana(x) }
  const next = () => { const x = new Date(semana); x.setDate(x.getDate() + 7); setSemana(x) }
  const hoy = () => setSemana(lunesDe(new Date()))
  const hoyISO = isoDia(new Date())

  const exportar = () => {
    const filas = dias.map(d => {
      const evs = porDia[isoDia(d)] || []
      const li = evs.map(e => `<li><b>${fmtHora(e.fecha_publicacion)}</b> — ${e.titulo} (${e.redes.map(r => REDES[r]?.corto).join(', ')})<br><span style="color:#555">${e.copy}</span></li>`).join('')
      return `<div style="margin-bottom:14px"><h3 style="color:#C8603A;margin:0 0 4px">${DIAS[(d.getDay()+6)%7]} ${d.getDate()}/${d.getMonth()+1}</h3><ul style="margin:0;padding-left:18px">${li || '<li style="color:#aaa">Sin publicaciones</li>'}</ul></div>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plan de contenido</title>
      <style>body{font-family:Arial;padding:24px;font-size:12px}h1{color:#0A0A0A}</style></head><body>
      <h1>Plan de Contenido — Semana del ${semana.getDate()}/${semana.getMonth()+1}</h1>${filas}
      <script>window.onload=function(){window.print()}</script></body></html>`
    const w = window.open('', '_blank', 'width=900,height=700'); if (w) { w.document.write(html); w.document.close() }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"><ChevronLeft size={16}/></button>
          <button onClick={hoy} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold hover:bg-gray-50">Hoy</button>
          <button onClick={next} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"><ChevronRight size={16}/></button>
          <span className="text-sm font-bold text-gray-700 ml-2">
            Semana del {semana.getDate()} de {MESES[semana.getMonth()]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {maxHueco > 4 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
              <AlertTriangle size={14}/> {maxHueco} días seguidos sin contenido
            </span>
          )}
          <button onClick={exportar} className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50">
            <Download size={14}/> Exportar semana
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {dias.map((d, i) => {
          const iso = isoDia(d)
          const evs = porDia[iso] || []
          const esHoy = iso === hoyISO
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col min-h-[160px]">
              <button onClick={() => onNew(`${iso}T12:00`)}
                className="px-2 py-2 border-b border-gray-100 text-left hover:bg-gray-50"
                style={esHoy ? { background: CORAL + '12' } : {}}>
                <p className="text-[10px] font-bold uppercase text-gray-400">{DIAS[i]}</p>
                <p className="text-sm font-bold" style={{ color: esHoy ? CORAL : '#374151' }}>{d.getDate()}</p>
              </button>
              <div className="p-1.5 space-y-1.5 flex-1">
                {evs.map(e => (
                  <button key={e.id} onClick={() => onEdit(e)}
                    className="w-full text-left rounded-lg border border-gray-100 p-1.5 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Clock size={10}/>{fmtHora(e.fecha_publicacion)}</span>
                      <RedBadges redes={e.redes} />
                    </div>
                    {e.archivo_url && e.archivo_tipo === 'imagen' && (
                      <img src={e.archivo_url} alt="" className="w-full h-14 object-cover rounded mb-1" />
                    )}
                    <p className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2">{e.titulo}</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5" style={{ background: ESTADO_COLOR[e.estado] + '20', color: ESTADO_COLOR[e.estado] }}>
                        {ESTADO_LABEL[e.estado]}
                      </span>
                      {e.campana_id && nombreCampana(e.campana_id) && (
                        <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5 text-white" style={{ background: CORAL }}>
                          {nombreCampana(e.campana_id)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// VISTA LISTA
// ════════════════════════════════════════════════════════════════
function ListView({ items, onEdit, onReload, nombreCampana }: {
  items: Contenido[]; onEdit: (e: Contenido) => void; onReload: () => void; nombreCampana: (id: number|null) => string|undefined
}) {
  const [fRed, setFRed] = useState(''); const [fTipo, setFTipo] = useState(''); const [fEstado, setFEstado] = useState('')

  const filtrados = useMemo(() => items
    .filter(i => !fRed || i.redes.includes(fRed as Red))
    .filter(i => !fTipo || i.tipo === fTipo)
    .filter(i => !fEstado || i.estado === fEstado)
    .sort((a, b) => (a.fecha_publicacion ?? '') < (b.fecha_publicacion ?? '') ? -1 : 1),
  [items, fRed, fTipo, fEstado])

  const dup = async (e: Contenido) => { await api.post(`/contenido/${e.id}/duplicar`, {}); onReload() }
  const del = async (e: Contenido) => { if (window.confirm(`¿Eliminar "${e.titulo}"?`)) { await api.delete(`/contenido/${e.id}`); onReload() } }
  const publicar = async (e: Contenido) => { await api.put(`/contenido/${e.id}`, { estado: 'publicado' }); onReload() }

  const sel = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
  const fmtFH = (iso: string | null) => iso ? `${iso.slice(8,10)}/${iso.slice(5,7)} ${iso.slice(11,16)}` : '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 bg-white rounded-xl border border-gray-100 px-4 py-3">
        <select className={sel} value={fRed} onChange={e => setFRed(e.target.value)}>
          <option value="">Todas las redes</option>
          {(Object.keys(REDES) as Red[]).map(r => <option key={r} value={r}>{REDES[r].label}</option>)}
        </select>
        <select className={sel} value={fTipo} onChange={e => setFTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.keys(TIPOS).map(t => <option key={t} value={t}>{TIPOS[t].label}</option>)}
        </select>
        <select className={sel} value={fEstado} onChange={e => setFEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.keys(ESTADO_LABEL).map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead style={{ background: NAVY }}>
            <tr>{['Fecha/hora','Título','Redes','Tipo','Estado','Acciones'].map(h => (
              <th key={h} className="text-white/70 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && <tr><td colSpan={6} className="text-center text-gray-300 py-10">Sin publicaciones</td></tr>}
            {filtrados.map((e, i) => (
              <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                <td className="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">{fmtFH(e.fecha_publicacion)}</td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-800">
                  {e.titulo}
                  {e.campana_id && nombreCampana(e.campana_id) && (
                    <span className="ml-1.5 text-[9px] font-semibold rounded-full px-1.5 py-0.5 text-white" style={{ background: CORAL }}>{nombreCampana(e.campana_id)}</span>
                  )}
                </td>
                <td className="px-3 py-2"><RedBadges redes={e.redes} /></td>
                <td className="px-3 py-2 text-xs text-gray-500">{TIPOS[e.tipo]?.label}</td>
                <td className="px-3 py-2">
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: ESTADO_COLOR[e.estado] + '20', color: ESTADO_COLOR[e.estado] }}>{ESTADO_LABEL[e.estado]}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(e)} title="Editar" className="p-1 text-gray-400 hover:text-gray-700"><Edit2 size={14}/></button>
                    <button onClick={() => dup(e)} title="Duplicar" className="p-1 text-gray-400 hover:text-gray-700"><Copy size={14}/></button>
                    {e.estado !== 'publicado' && <button onClick={() => publicar(e)} title="Marcar publicado" className="p-1 text-gray-400 hover:text-green-600"><Check size={14}/></button>}
                    <button onClick={() => del(e)} title="Eliminar" className="p-1 text-red-300 hover:text-red-600"><Trash2 size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// VISTA MES
// ════════════════════════════════════════════════════════════════
function MonthView({ items, onEdit }: { items: Contenido[]; onEdit: (e: Contenido) => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [diaSel, setDiaSel] = useState<string | null>(null)
  const { y, m } = cursor
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const diasMes = new Date(y, m + 1, 0).getDate()
  const celdas: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)]
  while (celdas.length % 7 !== 0) celdas.push(null)

  const porDia: Record<string, Contenido[]> = {}
  items.forEach(i => { if (i.fecha_publicacion) { const k = i.fecha_publicacion.slice(0,10); (porDia[k]=porDia[k]||[]).push(i) } })

  const prev = () => setCursor(m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 })
  const next = () => setCursor(m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18}/></button>
        <h2 className="text-lg font-bold text-gray-800">{MESES[m]} {y}</h2>
        <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18}/></button>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DIAS.map(d => <div key={d} className="px-2 py-2 text-center text-[11px] font-bold text-gray-400 uppercase">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((d, i) => {
          const iso = d ? `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` : ''
          const evs = d ? (porDia[iso] || []) : []
          const redesDelDia = Array.from(new Set(evs.flatMap(e => e.redes)))
          return (
            <div key={i} className={`min-h-[80px] border-b border-r border-gray-100 p-2 ${d ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50/40'}`}
              onClick={() => d && evs.length && setDiaSel(iso)}>
              {d && <p className="text-xs font-semibold text-gray-500 mb-1">{d}</p>}
              <div className="flex flex-wrap gap-1">
                {redesDelDia.map(r => <span key={r} className="w-2.5 h-2.5 rounded-full" style={{ background: REDES[r]?.bg }} />)}
              </div>
              {evs.length > 0 && <p className="text-[9px] text-gray-400 mt-1">{evs.length} pub.</p>}
            </div>
          )
        })}
      </div>
      {diaSel && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDiaSel(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Publicaciones del {diaSel.slice(8,10)}/{diaSel.slice(5,7)}</h3>
              <button onClick={() => setDiaSel(null)}><X size={18}/></button>
            </div>
            <div className="space-y-2">
              {(porDia[diaSel] || []).map(e => (
                <button key={e.id} onClick={() => { setDiaSel(null); onEdit(e) }} className="w-full text-left flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <span className="text-xs font-bold text-gray-500">{fmtHora(e.fecha_publicacion)}</span>
                  <span className="text-sm flex-1">{e.titulo}</span>
                  <RedBadges redes={e.redes} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MODAL CREAR / EDITAR
// ════════════════════════════════════════════════════════════════
function ContentModal({ ev, campanas, onClose, onSaved }: {
  ev: Partial<Contenido>; campanas: Campana[]; onClose: () => void; onSaved: () => void
}) {
  const [f, setF] = useState<Partial<Contenido>>({ ...EMPTY, ...ev })
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const editando = !!ev.id
  const set = (k: keyof Contenido, v: unknown) => setF(prev => ({ ...prev, [k]: v }))

  const redes = f.redes ?? []
  const toggleRed = (r: Red) => set('redes', redes.includes(r) ? redes.filter(x => x !== r) : [...redes, r])

  // Límite de copy según redes seleccionadas (el más restrictivo)
  const limite = redes.length ? Math.min(...redes.map(r => LIMITES[r])) : 2200
  const copyLen = (f.copy ?? '').length
  const hashCount = (f.hashtags ?? '').split(/[\s,]+/).filter(Boolean).length

  const subirArchivo = (file: File, carrusel: boolean) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      const tipo = file.type.startsWith('video') ? 'video' : 'imagen'
      if (carrusel) {
        set('archivos', [...(f.archivos ?? []), { url, tipo }].slice(0, 10))
      } else {
        set('archivo_url', url); set('archivo_tipo', tipo)
      }
    }
    reader.readAsDataURL(file)
  }

  const duplicarPara = async (red: Red) => {
    if (!ev.id) return
    try {
      const nuevo = await api.post<Contenido>(`/contenido/${ev.id}/duplicar`, {})
      await api.put(`/contenido/${nuevo.id}`, {
        redes: [red],
        titulo: (f.titulo ?? '') + ' — ' + REDES[red].corto,
        tipo: red === 'instagram_story' || red === 'whatsapp_estado' ? 'story' : f.tipo,
      })
      onSaved()
    } catch (err: unknown) { alert(`Error: ${err instanceof Error ? err.message : String(err)}`) }
  }

  const guardar = async () => {
    if (!f.titulo?.trim()) { alert('El título interno es obligatorio.'); return }
    setSaving(true)
    try {
      const payload = { ...f, fecha_publicacion: f.fecha_publicacion || null }
      if (editando) await api.put(`/contenido/${ev.id}`, payload)
      else          await api.post('/contenido', payload)
      onSaved()
    } catch (err: unknown) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setSaving(false) }
  }

  const input = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
  const lbl = "text-[11px] font-semibold text-gray-500 uppercase tracking-wide"
  const fechaVal = f.fecha_publicacion ? f.fecha_publicacion.slice(0, 10) : ''
  const horaVal  = f.fecha_publicacion ? f.fecha_publicacion.slice(11, 16) : '12:00'
  const setFechaHora = (fecha: string, hora: string) => set('fecha_publicacion', fecha ? `${fecha}T${hora || '12:00'}` : null)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div style={{ background: NAVY }} className="px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-white font-bold text-lg">{editando ? 'Editar publicación' : 'Nueva publicación'}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setPreview(p => !p)} className="flex items-center gap-1 text-white/70 hover:text-white text-xs"><Eye size={15}/> Preview</button>
            <button onClick={onClose} className="text-white/60 hover:text-white"><X size={22}/></button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-0">
          {/* ── Formulario ── */}
          <div className="p-6 space-y-4">
            {/* Sección 1 — Qué */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CORAL }}>1 · Qué</p>
              <div>
                <label className={lbl}>Título interno</label>
                <input className={input} value={f.titulo ?? ''} onChange={e => set('titulo', e.target.value)} placeholder="Referencia (no se publica)" autoFocus />
              </div>
              <div>
                <label className={lbl}>Redes</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {(Object.keys(REDES) as Red[]).filter(r => r !== 'email_doppler').map(r => (
                    <button key={r} type="button" onClick={() => toggleRed(r)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                      style={redes.includes(r) ? { background: REDES[r].color, color: 'white', borderColor: REDES[r].color } : { color: '#555', borderColor: '#e5e7eb' }}>
                      {REDES[r].icon} {REDES[r].corto}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Tipo</label>
                  <select className={input} value={f.tipo} onChange={e => set('tipo', e.target.value)}>
                    {Object.keys(TIPOS).map(t => <option key={t} value={t}>{TIPOS[t].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Campaña (opc.)</label>
                  <select className={input} value={f.campana_id ?? ''} onChange={e => set('campana_id', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— Ninguna —</option>
                    {campanas.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Sección 2 — Cuándo */}
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CORAL }}>2 · Cuándo</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Fecha</label><input type="date" className={input} value={fechaVal} onChange={e => setFechaHora(e.target.value, horaVal)} /></div>
                <div><label className={lbl}>Hora</label><input type="time" className={input} value={horaVal} onChange={e => setFechaHora(fechaVal, e.target.value)} /></div>
              </div>
              <p className="text-[10px] text-gray-400">{HORARIOS}</p>
            </div>

            {/* Sección 3 — Contenido */}
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CORAL }}>3 · Contenido</p>
              <div>
                <div className="flex items-center justify-between">
                  <label className={lbl}>Copy</label>
                  <span className={`text-[10px] font-semibold ${copyLen > limite ? 'text-red-500' : 'text-gray-400'}`}>{copyLen}/{limite}</span>
                </div>
                <textarea className={input} rows={4} value={f.copy ?? ''} onChange={e => set('copy', e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className={lbl}>Hashtags</label>
                  <span className={`text-[10px] font-semibold ${hashCount > 30 ? 'text-red-500' : 'text-gray-400'}`}>{hashCount}/30</span>
                </div>
                <textarea className={input} rows={2} value={f.hashtags ?? ''} onChange={e => set('hashtags', e.target.value)} placeholder="#SurMaderas #MarDelPlata …" />
              </div>
              <div>
                <label className={lbl}>{f.tipo === 'carrusel' ? 'Archivos (hasta 10)' : 'Archivo (imagen o video)'}</label>
                <label className="mt-1 flex items-center gap-2 text-xs font-semibold border border-dashed border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50 w-fit">
                  <Upload size={14}/> Subir
                  <input type="file" accept="image/*,video/*" multiple={f.tipo === 'carrusel'} className="hidden"
                    onChange={e => { const files = e.target.files; if (!files) return; Array.from(files).forEach(file => subirArchivo(file, f.tipo === 'carrusel')) }} />
                </label>
                {f.tipo !== 'carrusel' && f.archivo_url && (
                  <div className="mt-2 relative w-32">
                    {f.archivo_tipo === 'video'
                      ? <video src={f.archivo_url} className="w-32 h-32 object-cover rounded-lg" />
                      : <img src={f.archivo_url} alt="" className="w-32 h-32 object-cover rounded-lg" />}
                    <button onClick={() => { set('archivo_url',''); set('archivo_tipo','') }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"><X size={12}/></button>
                  </div>
                )}
                {f.tipo === 'carrusel' && (f.archivos?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {f.archivos!.map((a, idx) => (
                      <div key={idx} className="relative w-16">
                        <img src={a.url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                        <button onClick={() => set('archivos', f.archivos!.filter((_, i) => i !== idx))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center"><X size={10}/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sección 4 — Estado y notas */}
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CORAL }}>4 · Estado y notas</p>
              <div>
                <label className={lbl}>Estado</label>
                <select className={input} value={f.estado} onChange={e => set('estado', e.target.value)}>
                  {Object.keys(ESTADO_LABEL).map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Notas internas</label>
                <textarea className={input} rows={2} value={f.notas_internas ?? ''} onChange={e => set('notas_internas', e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Preview (mock teléfono) ── */}
          {preview && (
            <div className="bg-gray-100 p-6 flex flex-col items-center justify-start border-l border-gray-200">
              <p className="text-xs font-semibold text-gray-400 mb-3">Vista previa</p>
              <div className="bg-white rounded-[28px] shadow-xl p-2 w-[260px]" style={{ border: '6px solid #111' }}>
                {/* header mock */}
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="w-7 h-7 rounded-full" style={{ background: CORAL }}/>
                  <span className="text-xs font-bold">surmaderas</span>
                </div>
                {/* media */}
                {f.archivo_url ? (
                  f.archivo_tipo === 'video'
                    ? <video src={f.archivo_url} className={`w-full object-cover ${redes.includes('instagram_story') ? 'aspect-[9/16]' : 'aspect-square'}`} />
                    : <img src={f.archivo_url} alt="" className={`w-full object-cover ${redes.includes('instagram_story') ? 'aspect-[9/16]' : 'aspect-square'}`} />
                ) : (
                  <div className={`w-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs ${redes.includes('instagram_story') ? 'aspect-[9/16]' : 'aspect-square'}`}>Sin imagen</div>
                )}
                {/* copy */}
                <div className="px-2 py-2">
                  <p className="text-[11px] text-gray-800 whitespace-pre-wrap break-words">
                    <span className="font-bold">surmaderas</span> {f.copy}
                  </p>
                  {f.hashtags && <p className="text-[11px] text-blue-600 mt-1 break-words">{f.hashtags}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {editando && (
          <div className="px-6 pt-3 flex flex-wrap items-center gap-2 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400">Duplicar para otra red:</span>
            {(Object.keys(REDES) as Red[]).filter(r => r !== 'email_doppler').map(r => (
              <button key={r} onClick={() => duplicarPara(r)}
                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
                style={{ color: REDES[r].color }}>
                {REDES[r].icon} {REDES[r].corto}
              </button>
            ))}
          </div>
        )}

        <div className="px-6 pb-6 flex gap-2 border-t border-gray-100 pt-4 mt-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ background: CORAL }} className="flex-1 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
            {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear publicación'}
          </button>
        </div>
      </div>
    </div>
  )
}
