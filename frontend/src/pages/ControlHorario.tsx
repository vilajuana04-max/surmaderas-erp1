import { useEffect, useState } from 'react'
import { api } from '../api'
import { Clock, LogIn, LogOut, Calendar, Plus, Trash2, Pencil, X, RefreshCw } from 'lucide-react'

const NAVY = '#070614'
const CORAL = '#C8603A'
const GREEN = '#16a34a'
const RED = '#DC2626'

interface Emp {
  id: number; nombre: string; hora_entrada: string; hora_salida: string
  abierto: boolean; entrada_actual: string | null; entrada_actual_hora: string
  hoy_min: number; hoy_hhmm: string
}
interface Fichaje {
  id: number; empleado_id: number; fecha: string; entrada_hora: string; salida_hora: string
  min: number; abierto: boolean; nota: string
}
interface Fila {
  empleado_id: number; nombre: string; hora_entrada: string; hora_salida: string; activo: boolean
  total_min: number; total_hhmm: string; dias: number; fichajes: Fichaje[]
}
interface Resumen { month: string; total_general_hhmm: string; empleados: Fila[] }

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const mesLabel = (m: string) => {
  const [y, mm] = m.split('-').map(Number)
  return new Date(y, mm - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export default function ControlHorario() {
  const [tab, setTab] = useState<'fichaje' | 'resumen'>('fichaje')
  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="rounded-2xl p-6 mb-4" style={{ background: NAVY }}>
        <p className="text-[11px] font-bold tracking-[3px] uppercase mb-1" style={{ color: CORAL }}>Recursos Humanos</p>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2"><Clock size={26} /> Control horario</h1>
        <p className="text-white/50 text-sm">Cada empleado marca entrada y salida. Las horas se suman por mes.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {([['fichaje', 'Fichaje'], ['resumen', 'Resumen mensual']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className="px-4 py-2 rounded-xl text-sm font-bold transition"
            style={tab === k ? { background: NAVY, color: 'white' } : { background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'fichaje' ? <Fichar /> : <ResumenMes />}
    </div>
  )
}

/* ── Kiosco de fichaje ── */
function Fichar() {
  const [emps, setEmps] = useState<Emp[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [now, setNow] = useState(new Date())
  const [err, setErr] = useState('')

  const load = () => { api.get<Emp[]>('/fichaje/empleados').then(setEmps).catch(() => setEmps([])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const accion = async (e: Emp) => {
    setBusy(e.id); setErr('')
    try {
      await api.post(`/fichaje/${e.id}/${e.abierto ? 'salida' : 'entrada'}`, {})
      load()
    } catch (ex: any) {
      setErr(ex?.message?.replace(/^\d+:\s*/, '') || 'Error')
    } finally { setBusy(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">Hora actual: <strong className="font-mono text-gray-800">{now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></p>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700"><RefreshCw size={13} /> Actualizar</button>
      </div>
      {err && <p className="text-sm bg-red-50 text-red-600 rounded-lg px-3 py-2 mb-3 font-semibold">{err}</p>}
      {loading && <p className="text-center py-12 text-gray-400 text-sm">Cargando…</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        {emps.map((e) => (
          <div key={e.id} className="bg-white rounded-2xl border p-4 flex items-center justify-between gap-3"
            style={{ borderColor: e.abierto ? GREEN + '55' : '#eee' }}>
            <div className="min-w-0">
              <p className="font-bold text-gray-800 truncate">{e.nombre}</p>
              <p className="text-[11px] text-gray-400">Horario {e.hora_entrada}–{e.hora_salida}</p>
              {e.abierto
                ? <p className="text-xs font-semibold mt-1" style={{ color: GREEN }}>● Trabajando desde {e.entrada_actual_hora}</p>
                : <p className="text-xs text-gray-400 mt-1">Hoy: {e.hoy_hhmm} h</p>}
            </div>
            <button onClick={() => accion(e)} disabled={busy === e.id}
              className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: e.abierto ? RED : GREEN }}>
              {e.abierto ? <LogOut size={16} /> : <LogIn size={16} />}
              {busy === e.id ? '…' : e.abierto ? 'Salir' : 'Entrar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Resumen mensual ── */
function ResumenMes() {
  const [month, setMonth] = useState(thisMonth())
  const [data, setData] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [openEmp, setOpenEmp] = useState<number | null>(null)
  const [modal, setModal] = useState<{ emp: Fila; fichaje?: Fichaje } | null>(null)

  const load = () => { setLoading(true); api.get<Resumen>(`/fichaje/resumen?month=${month}`).then(setData).catch(() => setData(null)).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [month])

  const borrar = async (f: Fichaje) => {
    if (!window.confirm('¿Borrar este fichaje?')) return
    await api.delete(`/fichaje/fichajes/${f.id}`); load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" />
          <span className="text-sm text-gray-500 capitalize">{mesLabel(month)}</span>
        </div>
        {data && <p className="text-sm text-gray-500">Total equipo: <strong className="text-gray-800 font-mono">{data.total_general_hhmm} h</strong></p>}
      </div>

      {loading && <p className="text-center py-12 text-gray-400 text-sm">Cargando…</p>}
      {!loading && data && data.empleados.length === 0 && <p className="text-center py-12 text-gray-300 text-sm">Sin registros este mes.</p>}

      <div className="space-y-2">
        {data?.empleados.map((f) => (
          <div key={f.empleado_id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setOpenEmp(openEmp === f.empleado_id ? null : f.empleado_id)}>
              <div className="min-w-0">
                <p className="font-bold text-gray-800 truncate">{f.nombre} {!f.activo && <span className="text-[10px] text-gray-300">(inactivo)</span>}</p>
                <p className="text-[11px] text-gray-400">{f.hora_entrada}–{f.hora_salida} · {f.dias} día{f.dias === 1 ? '' : 's'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-lg" style={{ color: NAVY }}>{f.total_hhmm} h</p>
                <button onClick={(ev) => { ev.stopPropagation(); setModal({ emp: f }) }}
                  className="text-[11px] font-semibold flex items-center gap-1" style={{ color: CORAL }}><Plus size={12} /> Cargar manual</button>
              </div>
            </div>
            {openEmp === f.empleado_id && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {f.fichajes.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">Sin fichajes.</p>}
                {f.fichajes.map((fi) => (
                  <div key={fi.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-gray-400 text-xs w-20 shrink-0">{fi.fecha.split('-').reverse().join('/')}</span>
                      <span className="font-mono text-gray-700">{fi.entrada_hora} → {fi.abierto ? <span style={{ color: GREEN }}>en curso</span> : fi.salida_hora}</span>
                      {fi.nota && <span className="text-[11px] text-gray-400 truncate">· {fi.nota}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-semibold text-gray-600">{Math.floor(fi.min / 60)}:{String(fi.min % 60).padStart(2, '0')}</span>
                      <button onClick={() => setModal({ emp: f, fichaje: fi })} className="text-gray-300 hover:text-gray-700" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => borrar(fi)} className="text-red-300 hover:text-red-600" title="Borrar"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && <ManualModal emp={modal.emp} fichaje={modal.fichaje} month={month} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}

/* ── Cargar / editar fichaje manual ── */
function ManualModal({ emp, fichaje, month, onClose, onSaved }: { emp: Fila; fichaje?: Fichaje; month: string; onClose: () => void; onSaved: () => void }) {
  const editando = !!fichaje
  const [fecha, setFecha] = useState(fichaje?.fecha || `${month}-01`)
  const [entrada, setEntrada] = useState(fichaje?.entrada_hora || emp.hora_entrada || '08:00')
  const [salida, setSalida] = useState(fichaje?.salida_hora || emp.hora_salida || '17:00')
  const [nota, setNota] = useState(fichaje?.nota || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const guardar = async () => {
    setSaving(true); setErr('')
    try {
      const entradaDt = `${fecha}T${entrada}`
      const salidaDt = salida ? `${fecha}T${salida}` : null
      if (editando) await api.put(`/fichaje/fichajes/${fichaje!.id}`, { entrada: entradaDt, salida: salidaDt, nota })
      else await api.post('/fichaje/manual', { empleado_id: emp.empleado_id, entrada: entradaDt, salida: salidaDt, nota })
      onSaved()
    } catch (ex: any) { setErr(ex?.message?.replace(/^\d+:\s*/, '') || 'Error'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg" style={{ color: NAVY }}>{editando ? 'Editar fichaje' : 'Cargar fichaje'}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-600">{emp.nombre}</p>
          <div><label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">Entrada</label>
              <input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" /></div>
            <div><label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">Salida</label>
              <input type="time" value={salida} onChange={(e) => setSalida(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" /></div>
          </div>
          <p className="text-[11px] text-gray-400">Dejá la salida vacía si querés dejar el turno abierto (en curso).</p>
          <div><label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">Nota (opcional)</label>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: olvidó fichar" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" /></div>
          {err && <p className="text-xs bg-red-50 text-red-600 rounded-lg px-3 py-2 font-semibold">{err}</p>}
          <button onClick={guardar} disabled={saving} className="w-full text-white py-3 rounded-xl font-bold disabled:opacity-50" style={{ background: NAVY }}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
