// Sección Clientes — base de datos con compras y cupones (sync automático)
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import {
  Users, Search, Plus, X, Trash2, ShoppingBag, Gift, Ticket,
  CheckCircle, Calendar, Phone, Mail, Cake, MapPin, RefreshCw,
} from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'

// ── Types ─────────────────────────────────────────────────────────
interface Compra { id: number; fecha: string; monto: number | null; nota: string }
interface Feliz15 { id: number; anio: number; fecha: string }
interface Cliente {
  id: number
  numero_cliente: string
  nombre: string
  telefono: string
  email: string
  fecha_nacimiento: string | null
  sucursal: string
  notas: string
  cupon_registro_usado: boolean
  cupon_registro_fecha: string | null
  total_compras: number
  ultima_compra: string | null
  compras: Compra[]
  feliz15: Feliz15[]
}

const ANIO_ACTUAL = new Date().getFullYear()

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmt$(n: number | null): string {
  if (n == null) return '—'
  return `$ ${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}

// Etiqueta de frecuencia según cantidad de compras
function frecuenciaLabel(n: number): { txt: string; color: string } {
  if (n === 0) return { txt: 'Sin compras', color: '#9ca3af' }
  if (n < 3)   return { txt: 'Ocasional',   color: '#f59e0b' }
  if (n < 8)   return { txt: 'Frecuente',   color: '#2563eb' }
  return { txt: 'Muy frecuente', color: '#16a34a' }
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [q, setQ]               = useState('')
  const [loading, setLoading]   = useState(false)
  const [sel, setSel]           = useState<Cliente | null>(null)
  const [creando, setCreando]   = useState(false)
  const [sync, setSync]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<Cliente[]>(`/clientes?q=${encodeURIComponent(q)}`)
      setClientes(data)
    } catch { setClientes([]) }
    finally { setLoading(false) }
  }, [q])

  useEffect(() => {
    const t = setTimeout(load, 300)  // debounce de búsqueda
    return () => clearTimeout(t)
  }, [load])

  // Auto-sincronización con el registro de cupones al abrir la sección (silenciosa)
  useEffect(() => {
    let cancelado = false
    setSync(true)
    api.post('/clientes/sync-cupones', {})
      .then(() => { if (!cancelado) load() })
      .catch(() => { /* silencioso: si el server de encuestas no responde, no rompe la sección */ })
      .finally(() => { if (!cancelado) setSync(false) })
    return () => { cancelado = true }
  }, [])  // eslint-disable-line

  // Recargar el cliente seleccionado tras una acción
  const refreshSel = (c: Cliente) => {
    setSel(c)
    setClientes(prev => prev.map(x => x.id === c.id ? c : x))
  }

  const importarCupones = async () => {
    if (!window.confirm('¿Importar/actualizar clientes desde el registro de cupones?\n\nSe traen los datos de las encuestas (nombre, contacto, sucursal y estado del cupón de registro). No se pisan datos cargados manualmente.')) return
    setSync(true)
    try {
      const r = await api.post<{ creados: number; actualizados: number; total_encuestas: number }>('/clientes/sync-cupones', {})
      alert(`Listo ✓\n\nNuevos clientes: ${r.creados}\nActualizados: ${r.actualizados}\nEncuestas procesadas: ${r.total_encuestas}`)
      load()
    } catch (err: unknown) {
      alert(`Error al importar: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setSync(false) }
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div style={{ background: NAVY }} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase mb-1">Sur Maderas · ERP</p>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users size={22}/> Clientes</h1>
          <p className="text-white/50 text-sm">Base de datos de clientes, compras y cupones</p>
        </div>
        <div className="flex gap-2">
          <button onClick={importarCupones} disabled={sync}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            title="Se sincroniza automáticamente al abrir. Tocá para forzar ahora.">
            <RefreshCw size={15} className={sync ? 'animate-spin' : ''}/> {sync ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
          <button onClick={() => setCreando(true)}
            style={{ background: CORAL }}
            className="flex items-center gap-2 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <Plus size={16}/> Nuevo cliente
          </button>
        </div>
      </div>

      {/* ── Buscador ── */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
        <Search size={16} className="text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre, número de cliente, teléfono o email…"
          className="flex-1 text-sm outline-none bg-transparent" />
        {q && <button onClick={() => setQ('')} className="text-gray-400 hover:text-gray-600"><X size={15}/></button>}
      </div>

      {/* ── Lista ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading && <div className="text-center py-12 text-gray-400">Cargando…</div>}
        {!loading && clientes.length === 0 && (
          <div className="text-center py-12 text-gray-300">
            <Users size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">{q ? 'Sin resultados' : 'Todavía no hay clientes cargados'}</p>
          </div>
        )}
        {!loading && clientes.length > 0 && (
          <div className="divide-y divide-gray-100">
            {clientes.map(c => {
              const fr = frecuenciaLabel(c.total_compras)
              return (
                <button key={c.id} onClick={() => setSel(c)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                       style={{ background: CORAL }}>
                    {c.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {c.numero_cliente ? `#${c.numero_cliente}` : 'Sin nº'} · {c.telefono || 'sin tel.'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: fr.color + '18', color: fr.color }}>
                      {c.total_compras} compras
                    </span>
                    <p className="text-[10px] text-gray-400 mt-0.5">Últ: {fmtFecha(c.ultima_compra)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal detalle ── */}
      {sel && (
        <ClienteDetalle
          cliente={sel}
          onClose={() => setSel(null)}
          onChange={refreshSel}
          onDeleted={() => { setSel(null); load() }}
        />
      )}

      {/* ── Modal nuevo ── */}
      {creando && (
        <NuevoCliente
          onClose={() => setCreando(false)}
          onCreated={() => { setCreando(false); load() }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MODAL: Nuevo cliente
// ════════════════════════════════════════════════════════════════
function NuevoCliente({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ numero_cliente: '', nombre: '', telefono: '', email: '', fecha_nacimiento: '', sucursal: '', notas: '' })
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    if (!f.nombre.trim()) { alert('El nombre es obligatorio.'); return }
    setSaving(true)
    try {
      await api.post('/clientes', { ...f, fecha_nacimiento: f.fecha_nacimiento || null })
      onCreated()
    } catch (err: unknown) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setSaving(false) }
  }

  const input = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div style={{ background: NAVY }} className="px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Nuevo cliente</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={22}/></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre *</label>
            <input className={input} value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">N° cliente / cupón</label>
            <input className={input} value={f.numero_cliente} onChange={e => setF({ ...f, numero_cliente: e.target.value.toUpperCase() })} placeholder="Ej: AB1234" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Teléfono</label>
              <input className={input} value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nacimiento</label>
              <input type="date" className={input} value={f.fecha_nacimiento} onChange={e => setF({ ...f, fecha_nacimiento: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
            <input className={input} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sucursal</label>
            <select className={input} value={f.sucursal} onChange={e => setF({ ...f, sucursal: e.target.value })}>
              <option value="">—</option>
              <option value="Luro">Luro</option>
              <option value="Independencia">Independencia</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notas</label>
            <textarea className={input} rows={2} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ background: CORAL }}
            className="flex-1 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
            {saving ? 'Guardando…' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MODAL: Detalle de cliente
// ════════════════════════════════════════════════════════════════
function ClienteDetalle({ cliente, onClose, onChange, onDeleted }: {
  cliente: Cliente
  onClose: () => void
  onChange: (c: Cliente) => void
  onDeleted: () => void
}) {
  const [c, setC]       = useState(cliente)
  const [edit, setEdit] = useState({ ...cliente })
  const [busy, setBusy] = useState(false)

  useEffect(() => { setC(cliente); setEdit({ ...cliente }) }, [cliente])

  const fr = frecuenciaLabel(c.total_compras)
  const feliz15EsteAnio = c.feliz15.some(f => f.anio === ANIO_ACTUAL)

  const apply = (nuevo: Cliente) => { setC(nuevo); setEdit({ ...nuevo }); onChange(nuevo) }

  const guardarDatos = async () => {
    setBusy(true)
    try {
      const r = await api.put<Cliente>(`/clientes/${c.id}`, {
        numero_cliente:   edit.numero_cliente,
        nombre:           edit.nombre,
        telefono:         edit.telefono,
        email:            edit.email,
        fecha_nacimiento: edit.fecha_nacimiento || null,
        sucursal:         edit.sucursal,
        notas:            edit.notas,
      })
      apply(r)
    } catch (err: unknown) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setBusy(false) }
  }

  const registrarCompra = async () => {
    setBusy(true)
    try { apply(await api.post<Cliente>(`/clientes/${c.id}/compras`, {})) }
    finally { setBusy(false) }
  }

  const borrarCompra = async (id: number) => {
    if (!window.confirm('¿Borrar esta compra del historial?')) return
    setBusy(true)
    try { apply(await api.delete<Cliente>(`/clientes/${c.id}/compras/${id}`)) }
    finally { setBusy(false) }
  }

  const bajaFeliz15 = async () => {
    if (!window.confirm(`¿Dar de baja el cupón FELIZ15 de ${c.nombre} para ${ANIO_ACTUAL}? Solo se puede una vez por año.`)) return
    setBusy(true)
    try {
      apply(await api.post<Cliente>(`/clientes/${c.id}/feliz15`, {}))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err))
    } finally { setBusy(false) }
  }

  const eliminarCliente = async () => {
    if (!window.confirm(`¿Eliminar a ${c.nombre} de la base de datos? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    try { await api.delete(`/clientes/${c.id}`); onDeleted() }
    finally { setBusy(false) }
  }

  const input = "w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400"

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div style={{ background: NAVY }} className="px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: CORAL }}>
              {c.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-lg truncate">{c.nombre}</h2>
              <p className="text-white/50 text-xs">{c.numero_cliente ? `#${c.numero_cliente}` : 'Sin número'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white shrink-0"><X size={22}/></button>
        </div>

        <div className="p-6 space-y-5">
          {/* ── Datos básicos ── */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Datos del cliente</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] text-gray-400 flex items-center gap-1"><Users size={11}/> Nombre</label>
                <input className={input} value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 flex items-center gap-1"><Ticket size={11}/> N° cliente</label>
                <input className={input} value={edit.numero_cliente} onChange={e => setEdit({ ...edit, numero_cliente: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 flex items-center gap-1"><Phone size={11}/> Teléfono</label>
                <input className={input} value={edit.telefono} onChange={e => setEdit({ ...edit, telefono: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 flex items-center gap-1"><Cake size={11}/> Nacimiento</label>
                <input type="date" className={input} value={edit.fecha_nacimiento ?? ''} onChange={e => setEdit({ ...edit, fecha_nacimiento: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 flex items-center gap-1"><MapPin size={11}/> Sucursal</label>
                <select className={input} value={edit.sucursal} onChange={e => setEdit({ ...edit, sucursal: e.target.value })}>
                  <option value="">—</option>
                  <option value="Luro">Luro</option>
                  <option value="Independencia">Independencia</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-gray-400 flex items-center gap-1"><Mail size={11}/> Email</label>
                <input className={input} value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-gray-400">Notas</label>
                <textarea className={input} rows={2} value={edit.notas} onChange={e => setEdit({ ...edit, notas: e.target.value })} />
              </div>
            </div>
            <button onClick={guardarDatos} disabled={busy}
              className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: NAVY }}>
              Guardar cambios
            </button>
          </section>

          {/* ── Compras / frecuencia ── */}
          <section className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <ShoppingBag size={13}/> Compras
              </p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: fr.color + '18', color: fr.color }}>
                {fr.txt} · {c.total_compras}
              </span>
            </div>
            <button onClick={registrarCompra} disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 mb-3"
              style={{ background: CORAL }}>
              <Plus size={15}/> Registrar compra de hoy
            </button>
            {c.compras.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-2">Sin compras registradas</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {c.compras.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-sm py-1 border-b border-gray-50 group">
                    <Calendar size={13} className="text-gray-300 shrink-0" />
                    <span className="text-gray-700">{fmtFecha(m.fecha)}</span>
                    {m.monto != null && <span className="text-gray-400 text-xs">· {fmt$(m.monto)}</span>}
                    <button onClick={() => borrarCompra(m.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-opacity">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Cupones ── */}
          <section className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
              <Gift size={13}/> Cupones
            </p>

            {/* Cupón de registro — estado sincronizado desde el sistema de cupones (solo lectura) */}
            <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5 mb-2">
              <div className="flex items-center gap-2">
                <Ticket size={15} style={{ color: CORAL }} />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Cupón de registro (15% OFF)</p>
                  <p className="text-[11px] text-gray-400">
                    {c.cupon_registro_usado ? `Usado el ${fmtFecha(c.cupon_registro_fecha)}` : 'Disponible'}
                    <span className="ml-1 text-gray-300">· se sincroniza solo</span>
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={c.cupon_registro_usado
                  ? { background: '#16a34a18', color: '#16a34a' }
                  : { background: '#f3f4f6', color: '#9ca3af' }}>
                {c.cupon_registro_usado ? '✓ Usado' : 'Disponible'}
              </span>
            </div>

            {/* Cupón FELIZ15 (cumpleaños) */}
            <div className="rounded-xl border border-gray-100 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cake size={15} style={{ color: '#ec4899' }} />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">FELIZ15 (cumpleaños)</p>
                    <p className="text-[11px] text-gray-400">Una baja por año</p>
                  </div>
                </div>
                <button onClick={bajaFeliz15} disabled={busy || feliz15EsteAnio}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: feliz15EsteAnio ? '#9ca3af' : '#ec4899' }}>
                  {feliz15EsteAnio ? `Usado en ${ANIO_ACTUAL}` : 'Dar de baja'}
                </button>
              </div>
              {c.feliz15.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.feliz15.map(f => (
                    <span key={f.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 flex items-center gap-1">
                      <CheckCircle size={10}/> {f.anio} ({fmtFecha(f.fecha)})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Eliminar ── */}
          <section className="border-t border-gray-100 pt-4">
            <button onClick={eliminarCliente} disabled={busy}
              className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1 disabled:opacity-50">
              <Trash2 size={13}/> Eliminar cliente de la base
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
