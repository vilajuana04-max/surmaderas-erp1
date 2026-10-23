import { useEffect, useState } from 'react'
import { api } from '../api'
import {
  Clock, LogIn, LogOut, Calendar, Plus, Trash2, Pencil, X, RefreshCw,
  FileDown, Users, KeyRound, CalendarOff,
} from 'lucide-react'

const NAVY = '#070614'
const CORAL = '#C8603A'
const GREEN = '#16a34a'
const RED = '#DC2626'

interface Emp {
  id: number; nombre: string; hora_entrada: string; hora_salida: string
  tiene_pin: boolean; abierto: boolean; entrada_actual_hora: string; hoy_min: number; hoy_hhmm: string
}
interface Fichaje { id: number; empleado_id: number; fecha: string; entrada_hora: string; salida_hora: string; min: number; abierto: boolean; nota: string }
interface Dia {
  fecha: string; dow: string; tipo: string; feriado_nombre: string
  esperado_min: number; trabajado_min: number; trabajado_hhmm: string; fichajes: Fichaje[]
}
interface Fila {
  empleado_id: number; nombre: string; hora_entrada: string; hora_salida: string; activo: boolean
  trabajado_min: number; trabajado_hhmm: string; esperado_min: number; esperado_hhmm: string
  dias_trabajados: number; dias: Dia[]
}
interface Feriado { id: number; fecha: string; nombre: string }
interface Resumen { month: string; feriados: Feriado[]; total_general_hhmm: string; empleados: Fila[] }
interface AdminEmp { id: number; nombre: string; pin: string; hora_entrada: string; hora_salida: string; activo: boolean }

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const mesLabel = (m: string) => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) }
const ddmm = (f: string) => f.split('-').reverse().slice(0, 2).join('/')
const fmtMin = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
const TIPO: Record<string, { l: string; c: string; bg: string }> = {
  habil:   { l: 'Hábil',   c: '#374151', bg: '#F3F4F6' },
  sabado:  { l: 'Sábado',  c: '#1d4ed8', bg: '#EFF6FF' },
  feriado: { l: 'Feriado', c: '#b45309', bg: '#FFFBEB' },
  domingo: { l: 'Domingo', c: '#9CA3AF', bg: '#F9FAFB' },
}

export default function ControlHorario() {
  const [tab, setTab] = useState<'fichaje' | 'resumen' | 'empleados'>('fichaje')
  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="rounded-2xl p-6 mb-4" style={{ background: NAVY }}>
        <p className="text-[11px] font-bold tracking-[3px] uppercase mb-1" style={{ color: CORAL }}>Recursos Humanos</p>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2"><Clock size={26} /> Control horario</h1>
        <p className="text-white/50 text-sm">Cada empleado ficha con su PIN. Las horas se suman por mes.</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {([['fichaje', 'Fichaje'], ['resumen', 'Resumen mensual'], ['empleados', 'Empleados y PIN']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-4 py-2 rounded-xl text-sm font-bold transition"
            style={tab === k ? { background: NAVY, color: 'white' } : { background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' }}>{l}</button>
        ))}
      </div>

      {tab === 'fichaje' ? <Fichar /> : tab === 'resumen' ? <ResumenMes /> : <Empleados />}
    </div>
  )
}

/* ── Kiosco con PIN ── */
function Fichar() {
  const [emps, setEmps] = useState<Emp[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const [pinFor, setPinFor] = useState<Emp | null>(null)

  const load = () => { api.get<Emp[]>('/fichaje/empleados').then(setEmps).catch(() => setEmps([])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">Hora actual: <strong className="font-mono text-gray-800">{now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></p>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700"><RefreshCw size={13} /> Actualizar</button>
      </div>
      {loading && <p className="text-center py-12 text-gray-400 text-sm">Cargando…</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {emps.map((e) => (
          <div key={e.id} className="bg-white rounded-2xl border p-4 flex items-center justify-between gap-3" style={{ borderColor: e.abierto ? GREEN + '55' : '#eee' }}>
            <div className="min-w-0">
              <p className="font-bold text-gray-800 truncate">{e.nombre}</p>
              <p className="text-[11px] text-gray-400">Horario {e.hora_entrada}–{e.hora_salida}</p>
              {e.abierto
                ? <p className="text-xs font-semibold mt-1" style={{ color: GREEN }}>● Trabajando desde {e.entrada_actual_hora}</p>
                : <p className="text-xs text-gray-400 mt-1">Hoy: {e.hoy_hhmm} h</p>}
            </div>
            <button onClick={() => (e.tiene_pin ? setPinFor(e) : doAction(e, ''))}
              className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: e.abierto ? RED : GREEN }}>
              {e.abierto ? <LogOut size={16} /> : <LogIn size={16} />} {e.abierto ? 'Salir' : 'Entrar'}
            </button>
          </div>
        ))}
      </div>
      {pinFor && <PinModal emp={pinFor} onClose={() => setPinFor(null)} onOk={() => { setPinFor(null); load() }} />}
    </div>
  )

  async function doAction(e: Emp, pin: string) {
    try { await api.post(`/fichaje/${e.id}/${e.abierto ? 'salida' : 'entrada'}`, { pin }); load() }
    catch (ex: any) { alert(ex?.message?.replace(/^\d+:\s*/, '') || 'Error') }
  }
}

function PinModal({ emp, onClose, onOk }: { emp: Emp; onClose: () => void; onOk: () => void }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const confirmar = async () => {
    setBusy(true); setErr('')
    try { await api.post(`/fichaje/${emp.id}/${emp.abierto ? 'salida' : 'entrada'}`, { pin }); onOk() }
    catch (ex: any) { setErr(ex?.message?.replace(/^\d+:\s*/, '') || 'Error'); setBusy(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xs" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg" style={{ color: NAVY }}>{emp.abierto ? 'Marcar salida' : 'Marcar entrada'}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3 text-center">
          <p className="text-sm font-semibold text-gray-700">{emp.nombre}</p>
          <p className="text-xs text-gray-400">Ingresá tu PIN para confirmar</p>
          <input autoFocus type="password" inputMode="numeric" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onKeyDown={(e) => e.key === 'Enter' && pin && confirmar()}
            className="w-full text-center text-2xl font-mono tracking-[0.4em] border border-gray-200 rounded-xl px-3 py-3 outline-none focus:border-gray-400" placeholder="••••" />
          {err && <p className="text-xs bg-red-50 text-red-600 rounded-lg px-3 py-2 font-semibold">{err}</p>}
          <button onClick={confirmar} disabled={busy || !pin} className="w-full text-white py-3 rounded-xl font-bold disabled:opacity-50" style={{ background: emp.abierto ? RED : GREEN }}>{busy ? '…' : 'Confirmar'}</button>
        </div>
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
  const [modal, setModal] = useState<{ emp: Fila; fichaje?: Fichaje; fecha?: string } | null>(null)
  const [ferModal, setFerModal] = useState(false)

  const load = () => { setLoading(true); api.get<Resumen>(`/fichaje/resumen?month=${month}`).then(setData).catch(() => setData(null)).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [month])

  const borrar = async (f: Fichaje) => { if (!window.confirm('¿Borrar este fichaje?')) return; await api.delete(`/fichaje/fichajes/${f.id}`); load() }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" />
          <span className="text-sm text-gray-500 capitalize">{mesLabel(month)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setFerModal(true)} className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50"><CalendarOff size={14} /> Feriados</button>
          {data && data.empleados.length > 0 && (
            <button onClick={() => printResumen('Resumen de horas — equipo', data.empleados, data.feriados, month)} className="flex items-center gap-1.5 text-xs font-bold text-white rounded-lg px-3 py-2" style={{ background: NAVY }}><FileDown size={14} /> PDF del mes</button>
          )}
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
          <span className="text-gray-500">Total equipo: <strong className="text-gray-800 font-mono">{data.total_general_hhmm} h</strong></span>
          {data.feriados.length > 0 && <span className="text-gray-400">· Feriados: {data.feriados.map((f) => ddmm(f.fecha)).join(', ')}</span>}
        </div>
      )}

      {loading && <p className="text-center py-12 text-gray-400 text-sm">Cargando…</p>}
      {!loading && data && data.empleados.length === 0 && <p className="text-center py-12 text-gray-300 text-sm">Sin registros este mes.</p>}

      <div className="space-y-2">
        {data?.empleados.map((f) => (
          <div key={f.empleado_id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 cursor-pointer flex-1" onClick={() => setOpenEmp(openEmp === f.empleado_id ? null : f.empleado_id)}>
                <p className="font-bold text-gray-800 truncate">{f.nombre} {!f.activo && <span className="text-[10px] text-gray-300">(inactivo)</span>}</p>
                <p className="text-[11px] text-gray-400">{f.dias_trabajados} día{f.dias_trabajados === 1 ? '' : 's'} · esperado {f.esperado_hhmm} h</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-lg" style={{ color: NAVY }}>{f.trabajado_hhmm} h</p>
                <div className="flex items-center gap-2 justify-end mt-0.5">
                  <button onClick={() => printResumen('Resumen de horas', [f], data!.feriados, month)} className="text-[11px] font-semibold flex items-center gap-1 text-gray-500"><FileDown size={12} /> PDF</button>
                  <button onClick={() => setModal({ emp: f })} className="text-[11px] font-semibold flex items-center gap-1" style={{ color: CORAL }}><Plus size={12} /> Cargar</button>
                </div>
              </div>
            </div>
            {openEmp === f.empleado_id && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {f.dias.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">Sin días.</p>}
                {f.dias.map((d) => {
                  const t = TIPO[d.tipo] || TIPO.habil
                  return (
                    <div key={d.fecha} className="px-4 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-400 text-xs w-14 shrink-0">{d.dow} {ddmm(d.fecha)}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: t.c, background: t.bg }}>{d.feriado_nombre || t.l}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {d.esperado_min > 0 && <span className="text-[11px] text-gray-400">esp. {fmtMin(d.esperado_min)}</span>}
                          <span className="font-mono font-semibold" style={{ color: d.trabajado_min > 0 ? NAVY : '#d1d5db' }}>{d.trabajado_hhmm}</span>
                        </div>
                      </div>
                      {d.fichajes.length > 0 && (
                        <div className="mt-1 pl-16 flex flex-wrap gap-x-3 gap-y-1">
                          {d.fichajes.map((fi) => (
                            <span key={fi.id} className="text-[11px] text-gray-500 inline-flex items-center gap-1.5">
                              <span className="font-mono">{fi.entrada_hora} → {fi.abierto ? 'en curso' : fi.salida_hora}</span>
                              <button onClick={() => setModal({ emp: f, fichaje: fi })} className="text-gray-300 hover:text-gray-700"><Pencil size={12} /></button>
                              <button onClick={() => borrar(fi)} className="text-red-300 hover:text-red-600"><Trash2 size={12} /></button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && <ManualModal emp={modal.emp} fichaje={modal.fichaje} month={month} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
      {ferModal && <FeriadosModal month={month} onClose={() => { setFerModal(false); load() }} />}
    </div>
  )
}

/* ── Modal feriados ── */
function FeriadosModal({ month, onClose }: { month: string; onClose: () => void }) {
  const [rows, setRows] = useState<Feriado[]>([])
  const [fecha, setFecha] = useState(`${month}-01`)
  const [nombre, setNombre] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => api.get<Feriado[]>(`/fichaje/feriados?month=${month}`).then(setRows).catch(() => setRows([]))
  useEffect(() => { load() }, [])
  const add = async () => { if (!fecha) return; setBusy(true); try { await api.post('/fichaje/feriados', { fecha, nombre }); setNombre(''); await load() } catch (e: any) { alert(e?.message || e) } finally { setBusy(false) } }
  const del = async (id: number) => { await api.delete(`/fichaje/feriados/${id}`); load() }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg" style={{ color: NAVY }}>Feriados · {mesLabel(month)}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-400">Los días cargados acá no cuentan como falta en el resumen.</p>
          <div className="flex gap-2">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none" />
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (opc.)" className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
            <button onClick={add} disabled={busy} className="text-white px-3 rounded-lg text-sm font-bold disabled:opacity-50" style={{ background: NAVY }}>+</button>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-auto">
            {rows.length === 0 && <p className="text-xs text-gray-400 py-2">Sin feriados este mes.</p>}
            {rows.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700"><strong>{ddmm(f.fecha)}</strong> {f.nombre && <span className="text-gray-400">· {f.nombre}</span>}</span>
                <button onClick={() => del(f.id)} className="text-red-300 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Modal cargar/editar fichaje ── */
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
      const entradaDt = `${fecha}T${entrada}`, salidaDt = salida ? `${fecha}T${salida}` : null
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
          <div><label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">Nota (opcional)</label>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: olvidó fichar" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" /></div>
          {err && <p className="text-xs bg-red-50 text-red-600 rounded-lg px-3 py-2 font-semibold">{err}</p>}
          <button onClick={guardar} disabled={saving} className="w-full text-white py-3 rounded-xl font-bold disabled:opacity-50" style={{ background: NAVY }}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Empleados y PIN (admin) ── */
function Empleados() {
  const [rows, setRows] = useState<AdminEmp[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => { setLoading(true); api.get<AdminEmp[]>('/fichaje/admin/empleados').then(setRows).catch(() => setRows([])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  const save = async (e: AdminEmp) => {
    try { await api.put(`/fichaje/empleados/${e.id}`, { nombre: e.nombre, pin: e.pin, hora_entrada: e.hora_entrada, hora_salida: e.hora_salida, activo: e.activo }); alert('Guardado ✓') }
    catch (ex: any) { alert(ex?.message?.replace(/^\d+:\s*/, '') || 'Error') }
  }
  const set = (id: number, patch: Partial<AdminEmp>) => setRows((p) => p.map((r) => r.id === id ? { ...r, ...patch } : r))
  return (
    <div>
      <p className="text-sm text-gray-500 mb-3 flex items-center gap-1.5"><KeyRound size={14} /> Cada empleado ficha con su PIN. Cambialo cuando quieras.</p>
      {loading && <p className="text-center py-12 text-gray-400 text-sm">Cargando…</p>}
      <div className="space-y-2">
        {rows.map((e) => (
          <div key={e.id} className="bg-white rounded-2xl border border-gray-100 p-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
            <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 flex items-center gap-1"><Users size={11} /> Nombre</label>
              <input value={e.nombre} onChange={(ev) => set(e.id, { nombre: ev.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">PIN</label>
              <input value={e.pin} inputMode="numeric" onChange={(ev) => set(e.id, { pin: ev.target.value.replace(/\D/g, '').slice(0, 10) })} className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono tracking-widest outline-none" /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Entrada</label>
              <input type="time" value={e.hora_entrada} onChange={(ev) => set(e.id, { hora_entrada: ev.target.value })} className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none" /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Salida</label>
              <input type="time" value={e.hora_salida} onChange={(ev) => set(e.id, { hora_salida: ev.target.value })} className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none" /></div>
            <button onClick={() => save(e)} className="text-white px-4 py-2.5 rounded-lg text-sm font-bold" style={{ background: NAVY }}>Guardar</button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Export PDF (print) ── */
function printResumen(title: string, filas: Fila[], feriados: Feriado[], month: string) {
  const esc = (s: string) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
  const ferTxt = feriados.length ? `Feriados: ${feriados.map((f) => `${ddmm(f.fecha)}${f.nombre ? ' (' + esc(f.nombre) + ')' : ''}`).join(' · ')}` : ''
  const secciones = filas.map((f) => {
    const filasDias = f.dias.map((d) => {
      const t = TIPO[d.tipo] || TIPO.habil
      const det = d.fichajes.map((fi) => `${fi.entrada_hora}→${fi.abierto ? 'en curso' : fi.salida_hora}`).join(', ')
      return `<tr>
        <td>${d.dow} ${ddmm(d.fecha)}</td>
        <td>${esc(d.feriado_nombre || t.l)}</td>
        <td style="text-align:right">${d.esperado_min > 0 ? fmtMin(d.esperado_min) : '—'}</td>
        <td style="text-align:right"><b>${d.trabajado_min > 0 ? d.trabajado_hhmm : '—'}</b></td>
        <td style="color:#666">${esc(det)}</td>
      </tr>`
    }).join('')
    return `<section>
      <h2>${esc(f.nombre)}</h2>
      <p class="sub">Trabajado: <b>${f.trabajado_hhmm} h</b> · Esperado: ${f.esperado_hhmm} h · Días trabajados: ${f.dias_trabajados}</p>
      <table><thead><tr><th>Fecha</th><th>Tipo</th><th style="text-align:right">Esperado</th><th style="text-align:right">Trabajado</th><th>Detalle</th></tr></thead><tbody>${filasDias}</tbody></table>
    </section>`
  }).join('')
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)} ${month}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:28px;font-size:12px}
    h1{font-size:20px;margin:0 0 2px}
    .top{color:#6b7280;margin:0 0 4px;text-transform:capitalize}
    .fer{color:#b45309;font-size:11px;margin:0 0 14px}
    section{margin:0 0 20px;page-break-inside:avoid}
    h2{font-size:15px;margin:14px 0 2px;border-bottom:2px solid #111;padding-bottom:3px}
    .sub{color:#374151;margin:0 0 8px;font-size:11px}
    table{width:100%;border-collapse:collapse}
    th,td{border-bottom:1px solid #e5e7eb;padding:5px 7px;text-align:left}
    th{background:#f3f4f6;font-size:10px;text-transform:uppercase;letter-spacing:.3px}
    @media print{.noprint{display:none}}
  </style></head><body>
  <h1>Sur Maderas · Control horario</h1>
  <p class="top">${esc(mesLabel(month))}</p>
  ${ferTxt ? `<p class="fer">${ferTxt}</p>` : ''}
  ${secciones}
  <button class="noprint" onclick="window.print()" style="margin-top:10px;padding:10px 16px;font-weight:bold;border:none;border-radius:8px;background:#070614;color:#fff;cursor:pointer">Imprimir / Guardar PDF</button>
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) { alert('Permití las ventanas emergentes para exportar el PDF.'); return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch { /* */ } }, 400)
}
