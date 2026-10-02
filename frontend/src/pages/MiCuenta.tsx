import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { MODULE_LABELS, MODULES, Level } from '../permissions'
import { UserCircle, KeyRound } from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'
const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
const LEVEL_LABEL: Record<string, string> = { none: 'Sin acceso', view: 'Ver', edit: 'Editar', admin: 'Administrar' }
const LEVEL_COLOR: Record<string, string> = { none: '#cbd5e1', view: '#2563eb', edit: '#C8603A', admin: '#166534' }

export default function MiCuenta() {
  const { user } = useAuth()
  const [p0, setP0] = useState('')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [saving, setSaving] = useState(false)

  const cambiar = async () => {
    if (!p0) { alert('Ingresá tu contraseña actual.'); return }
    if (!p1 || p1.length < 4) { alert('La nueva contraseña es demasiado corta.'); return }
    if (p1 !== p2) { alert('Las contraseñas nuevas no coinciden.'); return }
    setSaving(true)
    try {
      await api.put('/auth/me/password', { current_password: p0, new_password: p1 })
      alert('Contraseña actualizada correctamente.')
      setP0(''); setP1(''); setP2('')
    } catch (e: any) { alert('Error: ' + (e?.message || e)) }
    finally { setSaving(false) }
  }

  const perms = user?.permissions || {}
  const activos = MODULES.filter(m => (perms[m] || 'none') !== 'none')

  return (
    <div className="max-w-xl mx-auto pb-16">
      <div className="rounded-2xl p-6 mb-4" style={{ background: NAVY }}>
        <p className="text-[11px] font-bold tracking-[3px] uppercase mb-1" style={{ color: CORAL }}>Sur Maderas · ERP</p>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2"><UserCircle size={28} /> Mi cuenta</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-[11px] text-gray-400 uppercase">Nombre</p><p className="font-semibold text-gray-700">{user?.name || user?.username}</p></div>
          <div><p className="text-[11px] text-gray-400 uppercase">Usuario</p><p className="font-semibold text-gray-700 font-mono">{user?.username}</p></div>
          <div><p className="text-[11px] text-gray-400 uppercase">Rol</p><p className="font-semibold text-gray-700">{user?.is_primary_admin ? 'Administrador principal' : user?.role}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-3">
        <p className="text-[11px] font-bold uppercase text-gray-400 mb-2">Tus accesos</p>
        <div className="flex flex-wrap gap-2">
          {activos.length === 0 && <p className="text-sm text-gray-300">Sin módulos asignados.</p>}
          {activos.map(m => (
            <span key={m} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#f3f4f6', color: '#374151' }}>
              {MODULE_LABELS[m]} · <span style={{ color: LEVEL_COLOR[perms[m] as Level] }}>{LEVEL_LABEL[perms[m]]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="font-bold text-gray-800 flex items-center gap-2 mb-3"><KeyRound size={16} /> Cambiar mi contraseña</p>
        <div className="space-y-2">
          <input className={inp} type="password" value={p0} onChange={e => setP0(e.target.value)} placeholder="Contraseña actual" autoComplete="current-password" />
          <input className={inp} type="password" value={p1} onChange={e => setP1(e.target.value)} placeholder="Nueva contraseña" autoComplete="new-password" />
          <input className={inp} type="password" value={p2} onChange={e => setP2(e.target.value)} placeholder="Confirmar nueva contraseña" autoComplete="new-password" />
        </div>
        <button onClick={cambiar} disabled={saving} className="w-full text-white py-2.5 rounded-xl font-bold mt-3 disabled:opacity-50" style={{ background: NAVY }}>
          {saving ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </div>
    </div>
  )
}
