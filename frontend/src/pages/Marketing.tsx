// Calendario de Contenido y Marketing — Sur Maderas
import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import {
  Calendar as CalIcon, List, BarChart3, ChevronLeft, ChevronRight,
  Plus, X, Trash2, Copy, Edit2, Download, Link as LinkIcon, Clock,
  Mail, MessageCircle, Megaphone, Star, Bell, Gift,
} from 'lucide-react'

const NAVY  = '#0A0A0A'
const CORAL = '#C8603A'

// ── Tipos / colores ───────────────────────────────────────────────
type Tipo = 'email_automatico' | 'campaña_manual' | 'promo' | 'fecha_especial' | 'recordatorio'
type Estado = 'idea' | 'en_progreso' | 'listo' | 'enviado'

interface Tarea { texto: string; canal: string; hecho: boolean }

interface Evento {
  id: number
  titulo: string
  fecha_inicio: string | null
  fecha_fin: string | null
  tipo: Tipo
  estado: Estado
  descripcion: string
  segmento: 'B2B' | 'B2C' | 'todos'
  descuento: string
  canal: 'email' | 'whatsapp' | 'ambos'
  asunto_email: string
  link_doppler: string
  es_permanente: boolean
  tareas: Tarea[]
  dias_preparacion: number
}

// ── Checklist por canal — qué preparar para cada uno ──────────────
const CANAL_TAREAS: Record<string, { label: string; icon: React.ReactNode; tareas: string[] }> = {
  sucursal_fisica: {
    label: 'Sucursal física', icon: <Megaphone size={13}/>,
    tareas: [
      'Cartelería / señalética en el local',
      'Actualizar precios y etiquetas',
      'Briefear al equipo de ventas',
      'Destacar producto en vidriera / góndola',
      'Verificar stock suficiente',
    ],
  },
  meta: {
    label: 'Meta Ads', icon: <Megaphone size={13}/>,
    tareas: [
      'Diseñar creatividades (feed + stories)',
      'Redactar copy del anuncio',
      'Definir segmentación y público',
      'Asignar presupuesto y fechas',
      'Programar campaña en Meta Ads',
    ],
  },
  instagram: {
    label: 'Instagram orgánico', icon: <Star size={13}/>,
    tareas: [
      'Diseñar posts y reels',
      'Escribir captions y hashtags',
      'Programar publicaciones',
      'Preparar stories del día',
    ],
  },
  email: {
    label: 'Email (Doppler)', icon: <Mail size={13}/>,
    tareas: [
      'Diseñar el email en Doppler',
      'Definir asunto y preheader',
      'Elegir lista / segmento',
      'Cargar cupón o descuento',
      'Programar envío y pegar el link',
    ],
  },
  whatsapp: {
    label: 'WhatsApp', icon: <MessageCircle size={13}/>,
    tareas: [
      'Redactar el mensaje',
      'Armar lista de difusión',
      'Definir horario de envío',
    ],
  },
}

const TIPO_COLOR: Record<Tipo, string> = {
  email_automatico: '#C8603A',
  campaña_manual:   '#2D5A8E',
  promo:            '#2D7A3A',
  fecha_especial:   '#E8A030',
  recordatorio:     '#888580',
}
const TIPO_LABEL: Record<Tipo, string> = {
  email_automatico: 'Email automático',
  campaña_manual:   'Campaña manual',
  promo:            'Promo',
  fecha_especial:   'Fecha especial',
  recordatorio:     'Recordatorio',
}
const TIPO_ICON: Record<Tipo, React.ReactNode> = {
  email_automatico: <Mail size={13}/>,
  campaña_manual:   <Megaphone size={13}/>,
  promo:            <Gift size={13}/>,
  fecha_especial:   <Star size={13}/>,
  recordatorio:     <Bell size={13}/>,
}
const ESTADO_COLOR: Record<Estado, string> = {
  idea:        '#888580',
  en_progreso: '#E8A030',
  listo:       '#2D5A8E',
  enviado:     '#2D7A3A',
}
const ESTADO_LABEL: Record<Estado, string> = {
  idea: 'Idea', en_progreso: 'En progreso', listo: 'Listo', enviado: 'Enviado',
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_SEM = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

function fmtFecha(iso: string | null): string {
  if (!iso) return 'Permanente'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const EMPTY: Omit<Evento, 'id'> = {
  titulo: '', fecha_inicio: null, fecha_fin: null, tipo: 'campaña_manual',
  estado: 'idea', descripcion: '', segmento: 'todos', descuento: '',
  canal: 'email', asunto_email: '', link_doppler: '', es_permanente: false,
  tareas: [], dias_preparacion: 30,
}

export default function Marketing() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [vista, setVista]     = useState<'calendario' | 'lista' | 'resumen'>('calendario')
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor]   = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [modal, setModal]     = useState<{ open: boolean; ev: Partial<Evento> } | null>(null)
  const [postsPorCampana, setPostsPorCampana] = useState<Record<number, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try { setEventos(await api.get<Evento[]>('/marketing')) }
    catch { setEventos([]) }
    finally { setLoading(false) }
    // Conteo de publicaciones de contenido vinculadas a cada campaña
    api.get<Record<number, number>>('/contenido/counts-por-campana')
      .then(setPostsPorCampana).catch(() => setPostsPorCampana({}))
  }, [])

  useEffect(() => { load() }, [load])

  const abrirNuevo = (fechaISO?: string) =>
    setModal({ open: true, ev: { ...EMPTY, fecha_inicio: fechaISO ?? null } })
  const abrirEditar = (ev: Evento) => setModal({ open: true, ev: { ...ev } })

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div style={{ background: NAVY }} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase mb-1">Sur Maderas · ERP</p>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><CalIcon size={22}/> Calendario de Marketing</h1>
          <p className="text-white/50 text-sm">Campañas, promos, fechas especiales y automatizaciones</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Switch de vista */}
          <div className="flex rounded-lg overflow-hidden border border-white/15">
            {([['calendario', CalIcon, 'Calendario'], ['lista', List, 'Lista'], ['resumen', BarChart3, 'Resumen']] as const).map(([id, Icon, label]) => (
              <button key={id} onClick={() => setVista(id)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all"
                style={vista === id ? { background: CORAL, color: 'white' } : { color: 'rgba(255,255,255,.5)' }}>
                <Icon size={14}/> {label}
              </button>
            ))}
          </div>
          <button onClick={() => abrirNuevo()}
            style={{ background: CORAL }}
            className="flex items-center gap-2 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <Plus size={16}/> Nueva campaña
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-12 text-gray-400">Cargando…</div>}

      {!loading && vista === 'calendario' && (
        <CalendarView eventos={eventos} cursor={cursor} setCursor={setCursor}
          onDay={abrirNuevo} onEvent={abrirEditar} />
      )}
      {!loading && vista === 'lista' && (
        <ListView eventos={eventos} onEdit={abrirEditar} onReload={load} postsPorCampana={postsPorCampana} />
      )}
      {!loading && vista === 'resumen' && <ResumenView eventos={eventos} />}

      {modal?.open && (
        <EventModal
          ev={modal.ev}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// VISTA CALENDARIO
// ════════════════════════════════════════════════════════════════
function CalendarView({ eventos, cursor, setCursor, onDay, onEvent }: {
  eventos: Evento[]
  cursor: { y: number; m: number }
  setCursor: (c: { y: number; m: number }) => void
  onDay: (iso: string) => void
  onEvent: (e: Evento) => void
}) {
  const { y, m } = cursor
  const primerDia = new Date(y, m, 1)
  const offset = (primerDia.getDay() + 6) % 7   // lunes = 0
  const diasMes = new Date(y, m + 1, 0).getDate()

  // ── Asignación de carriles (lanes) para barras continuas estilo Google ──
  // Para cada día (1..diasMes) y cada carril, qué evento lo ocupa.
  const { lanesPorDia, totalCarriles } = useMemo(() => {
    const firstOfMonth = new Date(y, m, 1)
    const lastOfMonth  = new Date(y, m, diasMes)

    // Eventos que se solapan con este mes, con su rango de días en el mes
    type Tramo = { ev: Evento; sIdx: number; eIdx: number; esPrep: boolean }
    const tramos: Tramo[] = []
    const pushClamped = (ev: Evento, start: Date, end: Date, esPrep: boolean) => {
      if (end < firstOfMonth || start > lastOfMonth) return
      const effStart = start < firstOfMonth ? firstOfMonth : start
      const effEnd   = end   > lastOfMonth  ? lastOfMonth  : end
      if (effStart > effEnd) return
      tramos.push({ ev, sIdx: effStart.getDate(), eIdx: effEnd.getDate(), esPrep })
    }
    eventos.forEach(ev => {
      if (!ev.fecha_inicio) return
      const start = new Date(ev.fecha_inicio + 'T12:00')
      const end   = ev.fecha_fin ? new Date(ev.fecha_fin + 'T12:00') : start
      // Ventana de preparación: N días antes del lanzamiento (color tenue)
      if (ev.dias_preparacion > 0) {
        const prepStart = new Date(start); prepStart.setDate(prepStart.getDate() - ev.dias_preparacion)
        const prepEnd   = new Date(start); prepEnd.setDate(prepEnd.getDate() - 1)
        pushClamped(ev, prepStart, prepEnd, true)
      }
      // Evento real
      pushClamped(ev, start, end, false)
    })

    // Orden: por día de inicio, y a igual inicio los más largos primero
    tramos.sort((a, b) => a.sIdx - b.sIdx || (b.eIdx - b.sIdx) - (a.eIdx - a.sIdx))

    // Greedy: el carril libre más bajo cuyo último día ocupado sea < sIdx
    const finCarril: number[] = []   // último día ocupado por carril
    const carrilDe = new Map<Tramo, number>()
    tramos.forEach(t => {
      let lane = 0
      while (lane < finCarril.length && finCarril[lane] >= t.sIdx) lane++
      finCarril[lane] = t.eIdx
      carrilDe.set(t, lane)
    })

    // Para cada día, array indexado por carril
    const lanesPorDia: Record<number, (Tramo | null)[]> = {}
    const total = finCarril.length
    for (let d = 1; d <= diasMes; d++) {
      lanesPorDia[d] = Array(total).fill(null)
    }
    tramos.forEach(t => {
      const lane = carrilDe.get(t)!
      for (let d = t.sIdx; d <= t.eIdx; d++) lanesPorDia[d][lane] = t
    })
    return { lanesPorDia, totalCarriles: total }
  }, [eventos, y, m, diasMes])

  const celdas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasMes }, (_, i) => i + 1),
  ]
  while (celdas.length % 7 !== 0) celdas.push(null)

  const prev = () => setCursor(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })
  const next = () => setCursor(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })
  const hoy = new Date()
  const isHoy = (d: number) => hoy.getFullYear() === y && hoy.getMonth() === m && hoy.getDate() === d

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18}/></button>
        <h2 className="text-lg font-bold text-gray-800">{MESES[m]} {y}</h2>
        <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18}/></button>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100">
        {DIAS_SEM.map(d => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wide">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {celdas.map((d, i) => {
          const iso = d ? `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` : ''
          const lanes = d ? lanesPorDia[d] : []
          const esLunes = i % 7 === 0   // primera columna de la semana
          return (
            <div key={i}
              className={`min-h-[92px] border-b border-r border-gray-100 px-1.5 pt-1.5 pb-1.5 overflow-hidden ${d ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50/40'}`}
              onClick={() => d && onDay(iso)}>
              {d && (
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${isHoy(d) ? 'text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-gray-500'}`}
                        style={isHoy(d) ? { background: CORAL } : {}}>{d}</span>
                </div>
              )}
              {d && (
                <div className="space-y-1">
                  {Array.from({ length: totalCarriles }).map((_, lane) => {
                    const t = lanes[lane]
                    if (!t) return <div key={lane} className="h-[18px]" />   // espaciador para alinear
                    const isStart = t.sIdx === d
                    const isEnd   = t.eIdx === d
                    // Mostrar el título en el inicio o al comenzar una nueva semana
                    const showTitle = isStart || esLunes
                    return (
                      <button key={lane}
                        onClick={ev => { ev.stopPropagation(); onEvent(t.ev) }}
                        title={t.esPrep ? `Preparar: ${t.ev.titulo}` : t.ev.titulo}
                        className="block text-left text-[10px] font-semibold h-[18px] leading-[18px] truncate"
                        style={{
                          background: t.esPrep ? TIPO_COLOR[t.ev.tipo] + '22' : TIPO_COLOR[t.ev.tipo],
                          color: t.esPrep ? TIPO_COLOR[t.ev.tipo] : '#fff',
                          border: t.esPrep ? `1px dashed ${TIPO_COLOR[t.ev.tipo]}88` : 'none',
                          marginLeft:  isStart ? 2 : -7,
                          marginRight: isEnd   ? 2 : -7,
                          paddingLeft:  isStart ? 6 : 8,
                          paddingRight: 6,
                          borderTopLeftRadius:     isStart ? 4 : 0,
                          borderBottomLeftRadius:  isStart ? 4 : 0,
                          borderTopRightRadius:    isEnd   ? 4 : 0,
                          borderBottomRightRadius: isEnd   ? 4 : 0,
                        }}>
                        {showTitle ? (t.esPrep ? 'Preparar: ' + t.ev.titulo : t.ev.titulo) : ' '}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 px-5 py-3 border-t border-gray-100">
        {(Object.keys(TIPO_COLOR) as Tipo[]).map(t => (
          <div key={t} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-3 h-3 rounded-sm" style={{ background: TIPO_COLOR[t] }}/>
            {TIPO_LABEL[t]}
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// VISTA LISTA
// ════════════════════════════════════════════════════════════════
function ListView({ eventos, onEdit, onReload, postsPorCampana }: {
  eventos: Evento[]; onEdit: (e: Evento) => void; onReload: () => void
  postsPorCampana: Record<number, number>
}) {
  const [fTipo, setFTipo]   = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fSeg, setFSeg]     = useState('')
  const [fMes, setFMes]     = useState('')

  const filtrados = useMemo(() => {
    return eventos
      .filter(e => !fTipo   || e.tipo === fTipo)
      .filter(e => !fEstado || e.estado === fEstado)
      .filter(e => !fSeg    || e.segmento === fSeg)
      .filter(e => !fMes    || (e.fecha_inicio && e.fecha_inicio.split('-')[1] === fMes))
      .sort((a, b) => {
        if (!a.fecha_inicio) return 1
        if (!b.fecha_inicio) return -1
        return a.fecha_inicio.localeCompare(b.fecha_inicio)
      })
  }, [eventos, fTipo, fEstado, fSeg, fMes])

  // Próximos 30 días
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const en30 = new Date(hoy); en30.setDate(en30.getDate() + 30)
  const proximos = eventos.filter(e => {
    if (!e.fecha_inicio) return false
    const f = new Date(e.fecha_inicio + 'T12:00')
    return f >= hoy && f <= en30
  }).sort((a, b) => (a.fecha_inicio! < b.fecha_inicio! ? -1 : 1))

  const duplicar = async (e: Evento, anioSig: boolean) => {
    await api.post(`/marketing/${e.id}/duplicar?anio_siguiente=${anioSig}`, {})
    onReload()
  }
  const eliminar = async (e: Evento) => {
    if (!window.confirm(`¿Eliminar "${e.titulo}"?`)) return
    await api.delete(`/marketing/${e.id}`)
    onReload()
  }

  const exportCSV = () => {
    const head = ['Fecha inicio','Fecha fin','Titulo','Tipo','Segmento','Estado','Canal','Descuento','Asunto','Link Doppler']
    const rows = filtrados.map(e => [
      e.fecha_inicio || 'Permanente', e.fecha_fin || '', e.titulo, TIPO_LABEL[e.tipo],
      e.segmento, ESTADO_LABEL[e.estado], e.canal, e.descuento, e.asunto_email, e.link_doppler,
    ].map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    const csv = [head.join(','), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'calendario-marketing-surmaderas.csv'
    a.click()
  }

  const sel = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"

  return (
    <div className="space-y-4">
      {/* Próximos 30 días */}
      {proximos.length > 0 && (
        <div className="rounded-2xl border-2 p-4" style={{ borderColor: CORAL + '40', background: CORAL + '08' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: CORAL }}>
            <Clock size={14}/> Próximos 30 días ({proximos.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {proximos.map(e => (
              <button key={e.id} onClick={() => onEdit(e)}
                className="flex items-center gap-1.5 text-xs font-semibold text-white rounded-lg px-2.5 py-1"
                style={{ background: TIPO_COLOR[e.tipo] }}>
                {TIPO_ICON[e.tipo]} {fmtFecha(e.fecha_inicio).slice(0, 5)} · {e.titulo}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-100 px-4 py-3">
        <select className={sel} value={fTipo} onChange={e => setFTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {(Object.keys(TIPO_LABEL) as Tipo[]).map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </select>
        <select className={sel} value={fEstado} onChange={e => setFEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_LABEL) as Estado[]).map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
        </select>
        <select className={sel} value={fSeg} onChange={e => setFSeg(e.target.value)}>
          <option value="">Todos los segmentos</option>
          <option value="B2B">B2B</option><option value="B2C">B2C</option><option value="todos">Todos</option>
        </select>
        <select className={sel} value={fMes} onChange={e => setFMes(e.target.value)}>
          <option value="">Todos los meses</option>
          {MESES.map((mm, i) => <option key={mm} value={String(i + 1).padStart(2, '0')}>{mm}</option>)}
        </select>
        <button onClick={exportCSV} className="ml-auto flex items-center gap-1.5 text-xs font-semibold border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
          <Download size={14}/> Exportar CSV
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead style={{ background: NAVY }}>
            <tr>
              {['Fecha','Título','Tipo','Segmento','Estado','Canal','Acciones'].map(h => (
                <th key={h} className="text-white/70 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="text-center text-gray-300 py-10 text-sm">Sin campañas que coincidan</td></tr>
            )}
            {filtrados.map((e, i) => (
              <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                <td className="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">{fmtFecha(e.fecha_inicio)}</td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-800">
                  {e.titulo}
                  {postsPorCampana[e.id] > 0 && (
                    <span className="ml-1.5 text-[9px] font-semibold rounded-full px-1.5 py-0.5 text-white" style={{ background: '#8134AF' }}
                      title="Publicaciones de contenido vinculadas">
                      {postsPorCampana[e.id]} posts
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white rounded px-1.5 py-0.5" style={{ background: TIPO_COLOR[e.tipo] }}>
                    {TIPO_ICON[e.tipo]} {TIPO_LABEL[e.tipo]}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{e.segmento}</td>
                <td className="px-3 py-2">
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: ESTADO_COLOR[e.estado] + '20', color: ESTADO_COLOR[e.estado] }}>
                    {ESTADO_LABEL[e.estado]}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 capitalize">{e.canal}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(e)} title="Editar" className="p-1 text-gray-400 hover:text-gray-700"><Edit2 size={14}/></button>
                    <button onClick={() => duplicar(e, false)} title="Duplicar" className="p-1 text-gray-400 hover:text-gray-700"><Copy size={14}/></button>
                    <button onClick={() => duplicar(e, true)} title="Duplicar para año siguiente" className="p-1 text-gray-400 hover:text-blue-600 text-[10px] font-bold">+1a</button>
                    <button onClick={() => eliminar(e)} title="Eliminar" className="p-1 text-red-300 hover:text-red-600"><Trash2 size={14}/></button>
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
// VISTA RESUMEN
// ════════════════════════════════════════════════════════════════
function ResumenView({ eventos }: { eventos: Evento[] }) {
  const porMes = useMemo(() => {
    const arr = Array(12).fill(0)
    eventos.forEach(e => { if (e.fecha_inicio) arr[Number(e.fecha_inicio.split('-')[1]) - 1]++ })
    return arr
  }, [eventos])
  const maxMes = Math.max(...porMes, 1)

  const cuenta = (pred: (e: Evento) => boolean) => eventos.filter(pred).length

  const Card = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Total campañas" value={eventos.length} color={NAVY} />
        <Card label="B2B" value={cuenta(e => e.segmento === 'B2B')} color="#2D5A8E" />
        <Card label="B2C" value={cuenta(e => e.segmento === 'B2C')} color={CORAL} />
        <Card label="Automatizaciones" value={cuenta(e => e.es_permanente)} color="#2D7A3A" />
      </div>

      {/* Por estado */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Por estado</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(ESTADO_LABEL) as Estado[]).map(s => (
            <div key={s} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: ESTADO_COLOR[s] }}/>
              <span className="text-sm text-gray-600 flex-1">{ESTADO_LABEL[s]}</span>
              <span className="text-sm font-bold text-gray-800">{cuenta(e => e.estado === s)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Por mes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Campañas por mes</p>
        <div className="flex items-end gap-2 h-40">
          {porMes.map((n, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t" style={{ height: `${(n / maxMes) * 100}%`, minHeight: n ? 6 : 0, background: CORAL }}/>
              <span className="text-[9px] text-gray-400">{MESES[i].slice(0, 3)}</span>
              <span className="text-[10px] font-bold text-gray-600">{n || ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MODAL CREAR / EDITAR
// ════════════════════════════════════════════════════════════════
function EventModal({ ev, onClose, onSaved }: {
  ev: Partial<Evento>; onClose: () => void; onSaved: () => void
}) {
  const [f, setF] = useState<Partial<Evento>>({ ...EMPTY, ...ev })
  const [saving, setSaving] = useState(false)
  const editando = !!ev.id

  const set = (k: keyof Evento, v: unknown) => setF(prev => ({ ...prev, [k]: v }))

  // ── Checklist por canal ──
  const tareas: Tarea[] = f.tareas ?? []
  const canalesActivos = new Set(tareas.map(t => t.canal))

  const toggleCanal = (canal: string) => {
    if (canalesActivos.has(canal)) {
      set('tareas', tareas.filter(t => t.canal !== canal))
    } else {
      const nuevas = CANAL_TAREAS[canal].tareas.map(texto => ({ texto, canal, hecho: false }))
      set('tareas', [...tareas, ...nuevas])
    }
  }
  const toggleTarea = (idx: number) =>
    set('tareas', tareas.map((t, i) => i === idx ? { ...t, hecho: !t.hecho } : t))

  const totalTareas = tareas.length
  const hechas = tareas.filter(t => t.hecho).length

  const guardar = async () => {
    if (!f.titulo?.trim()) { alert('El título es obligatorio.'); return }
    setSaving(true)
    try {
      const payload = { ...f, fecha_inicio: f.fecha_inicio || null, fecha_fin: f.fecha_fin || null }
      if (editando) await api.put(`/marketing/${ev.id}`, payload)
      else          await api.post('/marketing', payload)
      onSaved()
    } catch (err: unknown) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setSaving(false) }
  }

  const input = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
  const lbl = "text-[11px] font-semibold text-gray-500 uppercase tracking-wide"

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div style={{ background: NAVY }} className="px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-white font-bold text-lg">{editando ? 'Editar campaña' : 'Nueva campaña'}</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={22}/></button>
        </div>

        <div className="p-6 space-y-3">
          <div>
            <label className={lbl}>Título *</label>
            <input className={input} value={f.titulo ?? ''} onChange={e => set('titulo', e.target.value)} autoFocus />
          </div>

          {/* Tipo con íconos */}
          <div>
            <label className={lbl}>Tipo</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {(Object.keys(TIPO_LABEL) as Tipo[]).map(t => (
                <button key={t} type="button" onClick={() => set('tipo', t)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={f.tipo === t
                    ? { background: TIPO_COLOR[t], color: 'white', borderColor: TIPO_COLOR[t] }
                    : { color: '#555', borderColor: '#e5e7eb' }}>
                  {TIPO_ICON[t]} {TIPO_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha inicio</label>
              <input type="date" className={input} value={f.fecha_inicio ?? ''} onChange={e => set('fecha_inicio', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Fecha fin (opc.)</label>
              <input type="date" className={input} value={f.fecha_fin ?? ''} onChange={e => set('fecha_fin', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Estado</label>
              <select className={input} value={f.estado} onChange={e => set('estado', e.target.value)}>
                {(Object.keys(ESTADO_LABEL) as Estado[]).map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Segmento</label>
              <select className={input} value={f.segmento} onChange={e => set('segmento', e.target.value)}>
                <option value="todos">Todos</option><option value="B2B">B2B</option><option value="B2C">B2C</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Canal</label>
              <select className={input} value={f.canal} onChange={e => set('canal', e.target.value)}>
                <option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="ambos">Ambos</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Descuento (opc.)</label>
              <input className={input} value={f.descuento ?? ''} onChange={e => set('descuento', e.target.value)} placeholder="Ej: 15%" />
            </div>
            <div>
              <label className={lbl} title="Días antes del lanzamiento en que el calendario te muestra el aviso de preparación (tenue)">
                Preparar (días antes)
              </label>
              <input type="number" min={0} className={input}
                value={f.dias_preparacion ?? 0}
                onChange={e => set('dias_preparacion', parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={!!f.es_permanente} onChange={e => set('es_permanente', e.target.checked)} />
            Automatización permanente (sin fecha)
          </label>

          {/* ── Checklist de preparación por canal ── */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className={lbl}>Checklist por canal</p>
              {totalTareas > 0 && (
                <span className="text-[11px] font-semibold" style={{ color: hechas === totalTareas ? '#2D7A3A' : CORAL }}>
                  {hechas}/{totalTareas} listas
                </span>
              )}
            </div>
            {/* Toggles de canal */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.entries(CANAL_TAREAS).map(([key, { label, icon }]) => (
                <button key={key} type="button" onClick={() => toggleCanal(key)}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all"
                  style={canalesActivos.has(key)
                    ? { background: CORAL, color: 'white', borderColor: CORAL }
                    : { color: '#555', borderColor: '#e5e7eb' }}>
                  {icon} {label}
                </button>
              ))}
            </div>
            {/* Tareas agrupadas por canal */}
            {totalTareas === 0 ? (
              <p className="text-[11px] text-gray-300 italic">Elegí los canales para cargar la checklist de cada uno.</p>
            ) : (
              <div className="space-y-3">
                {Object.keys(CANAL_TAREAS).filter(c => canalesActivos.has(c)).map(canal => (
                  <div key={canal}>
                    <p className="text-[11px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                      {CANAL_TAREAS[canal].icon} {CANAL_TAREAS[canal].label}
                    </p>
                    <div className="space-y-1">
                      {tareas.map((t, idx) => t.canal === canal && (
                        <label key={idx} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input type="checkbox" checked={t.hecho} onChange={() => toggleTarea(idx)} />
                          <span className={t.hecho ? 'line-through text-gray-400' : ''}>{t.texto}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={lbl}><Mail size={11} className="inline mr-1"/> Asunto del email (opc.)</label>
            <input className={input} value={f.asunto_email ?? ''} onChange={e => set('asunto_email', e.target.value)} />
          </div>

          <div>
            <label className={lbl}><LinkIcon size={11} className="inline mr-1"/> Link de Doppler (opc.)</label>
            <input className={input} value={f.link_doppler ?? ''} onChange={e => set('link_doppler', e.target.value)} placeholder="https://app.fromdoppler.com/…" />
          </div>

          <div>
            <label className={lbl}>Notas / descripción</label>
            <textarea className={input} rows={3} value={f.descripcion ?? ''} onChange={e => set('descripcion', e.target.value)} />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ background: CORAL }}
            className="flex-1 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
            {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear campaña'}
          </button>
        </div>
      </div>
    </div>
  )
}
