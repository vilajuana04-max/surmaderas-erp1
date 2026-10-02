import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { Level } from '../permissions'
import {
  UserPlus, Search, X, Pencil, KeyRound, Pause, Play, Trash2, ShieldCheck, History, Save,
} from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'

interface UserRow {
  id: number; name: string; username: string; role: string; branch?: string; active: boolean
  is_primary_admin: boolean; is_admin: boolean
  last_login_at: string | null; created_at: string | null
  permissions: Record<string, Level>
}
interface Meta {
  modules: { key: string; label: string }[]
  levels: Level[]
  roles: string[]
  role_templates: Record<string, Record<string, Level>>
}
interface AuditRow { id: number; created_at: string | null; actor: string; action: string; target: string; detail: string }

const fmtFecha = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
const LEVEL_LABEL: Record<Level, string> = { none: 'Sin acceso', view: 'Ver', edit: 'Editar', admin: 'Administrar' }
const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
const lbl = "text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1"

export default function Usuarios() {
  const { user, refresh } = useAuth()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [editor, setEditor] = useState<UserRow | 'nuevo' | null>(null)
  const [pwdFor, setPwdFor] = useState<UserRow | null>(null)
  const [showAudit, setShowAudit] = useState(false)

  const load = () => {
    setLoading(true)
    api.get<UserRow[]>('/users').then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }
  useEffect(() => {
    api.get<Meta>('/users/meta').then(setMeta).catch(() => setMeta(null))
    load()
  }, [])

  const filtered = useMemo(() => rows.filter(u => {
    if (filtro === 'activos' && !u.active) return false
    if (filtro === 'pausados' && u.active) return false
    if (filtro.startsWith('rol:') && u.role !== filtro.slice(4)) return false
    if (search.trim()) {
      const s = search.toLowerCase()
      if (!u.name.toLowerCase().includes(s) && !u.username.toLowerCase().includes(s)) return false
    }
    return true
  }), [rows, filtro, search])

  const pausar = async (u: UserRow) => {
    if (!confirm(`¿Pausar al usuario ${u.name}?\n${u.name} no podrá iniciar sesión hasta que sea reactivado.`)) return
    try { await api.post(`/users/${u.id}/pause`, {}); load() } catch (e: any) { alert(e?.message || e) }
  }
  const activar = async (u: UserRow) => { try { await api.post(`/users/${u.id}/activate`, {}); load() } catch (e: any) { alert(e?.message || e) } }
  const eliminar = async (u: UserRow) => {
    if (!confirm(`¿Eliminar definitivamente a ${u.name}? Solo se permite si nunca tuvo actividad.`)) return
    try { await api.delete(`/users/${u.id}`); load() } catch (e: any) { alert(e?.message || e) }
  }

  const afterSave = () => { setEditor(null); load(); refresh() }

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="rounded-2xl p-6 mb-4 flex items-center justify-between flex-wrap gap-3" style={{ background: NAVY }}>
        <div>
          <p className="text-[11px] font-bold tracking-[3px] uppercase mb-1" style={{ color: CORAL }}>Configuración</p>
          <h1 className="text-3xl font-bold text-white">Usuarios</h1>
          <p className="text-white/50 text-sm">Gestión de empleados, roles y permisos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAudit(true)} className="flex items-center gap-2 text-white/90 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-sm font-semibold"><History size={16} /> Historial</button>
          <button onClick={() => setEditor('nuevo')} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-bold" style={{ background: CORAL }}><UserPlus size={16} /> Nuevo usuario</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search size={15} className="text-gray-300" />
          <input className="flex-1 text-sm outline-none" placeholder="Buscar por nombre o usuario…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="pausados">Pausados</option>
          {meta?.roles.map(r => <option key={r} value={`rol:${r}`}>Rol: {r}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-50">
                {['Nombre', 'Usuario', 'Rol', 'Estado', 'Alta', 'Último acceso', ''].map(h => <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Cargando…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-300">Sin usuarios.</td></tr>}
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-semibold text-gray-700">
                    {u.name} {u.is_primary_admin && <ShieldCheck size={13} className="inline" style={{ color: CORAL }} />}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{u.username}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{u.role}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: u.active ? '#dcfce7' : '#fee2e2', color: u.active ? '#166534' : '#b91c1c' }}>
                      {u.active ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{u.created_at ? fmtFecha(u.created_at).slice(0, 8) : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{fmtFecha(u.last_login_at)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditor(u)} className="text-gray-300 hover:text-gray-700 p-1" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => setPwdFor(u)} className="text-gray-300 hover:text-gray-700 p-1" title="Cambiar contraseña"><KeyRound size={14} /></button>
                      {!u.is_primary_admin && u.id !== user?.id && (
                        u.active
                          ? <button onClick={() => pausar(u)} className="text-amber-400 hover:text-amber-600 p-1" title="Pausar"><Pause size={14} /></button>
                          : <button onClick={() => activar(u)} className="text-green-500 hover:text-green-700 p-1" title="Reactivar"><Play size={14} /></button>
                      )}
                      {!u.is_primary_admin && u.id !== user?.id && !u.last_login_at && (
                        <button onClick={() => eliminar(u)} className="text-red-300 hover:text-red-600 p-1" title="Eliminar"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editor && meta && <UserEditor user={editor === 'nuevo' ? null : editor} meta={meta} onClose={() => setEditor(null)} onSaved={afterSave} />}
      {pwdFor && <PasswordModal user={pwdFor} onClose={() => setPwdFor(null)} />}
      {showAudit && <AuditModal onClose={() => setShowAudit(false)} />}
    </div>
  )
}

/* ── Editor crear/editar ───────────────────────────────────────── */
function UserEditor({ user, meta, onClose, onSaved }: { user: UserRow | null; meta: Meta; onClose: () => void; onSaved: () => void }) {
  const editando = !!user
  const [name, setName] = useState(user?.name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user?.role || 'Personalizado')
  const [branch, setBranch] = useState<string>(user?.branch || '')
  const [active, setActive] = useState(user?.active ?? true)
  const [perms, setPerms] = useState<Record<string, Level>>(() => {
    if (user) return { ...user.permissions }
    return meta.role_templates['Personalizado'] || {}
  })
  const [saving, setSaving] = useState(false)

  const aplicarRol = (r: string) => {
    setRole(r)
    const tpl = meta.role_templates[r]
    if (tpl) { const next: Record<string, Level> = {}; meta.modules.forEach(m => next[m.key] = tpl[m.key] || 'none'); setPerms(next) }
  }
  const setCell = (mod: string, lvl: Level) => { setPerms(p => ({ ...p, [mod]: lvl })); setRole('Personalizado') }

  const guardar = async () => {
    if (!name.trim()) { alert('El nombre es obligatorio.'); return }
    if (!editando && !username.trim()) { alert('El usuario es obligatorio.'); return }
    if (!editando && !password) { alert('La contraseña inicial es obligatoria.'); return }
    setSaving(true)
    try {
      if (editando) {
        await api.put(`/users/${user!.id}`, { name: name.trim(), role, branch: branch || null, active, permissions: perms })
      } else {
        await api.post('/users', { name: name.trim(), username: username.trim(), password, role, branch: branch || null, permissions: perms })
      }
      onSaved()
    } catch (e: any) { alert('Error: ' + (e?.message || e)); setSaving(false) }
  }

  const seg = (mod: string, lvl: Level) => {
    const on = (perms[mod] || 'none') === lvl
    const color = lvl === 'none' ? '#9ca3af' : lvl === 'view' ? '#2563eb' : lvl === 'edit' ? '#C8603A' : '#166534'
    return (
      <button key={lvl} onClick={() => setCell(mod, lvl)}
        className="flex-1 py-1 text-[11px] font-semibold rounded transition-all"
        style={on ? { background: color, color: '#fff' } : { color: '#9ca3af' }}>
        {LEVEL_LABEL[lvl]}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-lg" style={{ color: NAVY }}>{editando ? `Editar ${user!.name}` : 'Nuevo usuario'}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nombre *</label><input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Cecilia" /></div>
            <div>
              <label className={lbl}>Usuario *</label>
              <input className={inp} value={username} onChange={e => setUsername(e.target.value)} placeholder="Ej: ceci" disabled={editando} />
              {editando && <p className="text-[10px] text-gray-300 mt-0.5">El nombre de usuario no se puede cambiar.</p>}
            </div>
          </div>
          {!editando && (
            <div><label className={lbl}>Contraseña inicial *</label><input className={inp} type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="La podrá cambiar después" /></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Rol (plantilla)</label>
              <select className={inp} value={role} onChange={e => aplicarRol(e.target.value)}>
                {meta.roles.map(r => <option key={r} value={r}>{r}</option>)}
                {!meta.roles.includes(role) && <option value={role}>{role}</option>}
              </select>
            </div>
            {editando && (
              <div>
                <label className={lbl}>Estado</label>
                <div className="flex gap-2">
                  <button onClick={() => setActive(true)} disabled={user?.is_primary_admin} className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${active ? 'text-white' : 'bg-white text-gray-400 border-gray-200'}`} style={active ? { background: '#166534', borderColor: '#166534' } : {}}>Activo</button>
                  <button onClick={() => setActive(false)} disabled={user?.is_primary_admin} className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${!active ? 'text-white' : 'bg-white text-gray-400 border-gray-200'}`} style={!active ? { background: '#b91c1c', borderColor: '#b91c1c' } : {}}>Pausado</button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={lbl}>Sucursal (para Caja Diaria)</label>
            <select className={inp} value={branch} onChange={e => setBranch(e.target.value)}>
              <option value="">Todas las sucursales</option>
              <option value="luro">Solo Luro</option>
              <option value="independencia">Solo Independencia</option>
            </select>
            <p className="text-[11px] text-gray-400 mt-0.5">Si elegís una sucursal, el usuario solo ve/usa la caja de esa sucursal.</p>
          </div>

          <div>
            <label className={lbl}>Permisos por módulo</label>
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
              {meta.modules.map(m => (
                <div key={m.key} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-sm font-semibold text-gray-700 w-40 shrink-0">{m.label}</span>
                  <div className="flex-1 flex gap-1 bg-gray-50 rounded-lg p-0.5">
                    {(['none', 'view', 'edit', 'admin'] as Level[]).map(lvl => seg(m.key, lvl))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Al tocar un rol se cargan permisos sugeridos; si los modificás, el rol queda como "Personalizado".</p>
          </div>

          <button onClick={guardar} disabled={saving} className="w-full text-white py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: NAVY }}>
            <Save size={16} /> {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Cambiar contraseña (admin) ────────────────────────────────── */
function PasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [saving, setSaving] = useState(false)
  const guardar = async () => {
    if (!p1 || p1.length < 4) { alert('La contraseña es demasiado corta.'); return }
    if (p1 !== p2) { alert('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try { await api.put(`/users/${user.id}/password`, { password: p1 }); alert('Contraseña actualizada. La anterior deja de funcionar.'); onClose() }
    catch (e: any) { alert(e?.message || e); setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg" style={{ color: NAVY }}>Contraseña de {user.name}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="text-xs text-amber-600 mb-3">La contraseña actual dejará de funcionar.</p>
        <div className="space-y-2">
          <input className={inp} type="text" value={p1} onChange={e => setP1(e.target.value)} placeholder="Nueva contraseña" />
          <input className={inp} type="text" value={p2} onChange={e => setP2(e.target.value)} placeholder="Confirmar contraseña" />
        </div>
        <button onClick={guardar} disabled={saving} className="w-full text-white py-2.5 rounded-xl font-bold mt-3 disabled:opacity-50" style={{ background: NAVY }}>{saving ? 'Guardando…' : 'Cambiar contraseña'}</button>
      </div>
    </div>
  )
}

/* ── Historial de administración ───────────────────────────────── */
function AuditModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get<AuditRow[]>('/users/audit').then(setRows).catch(() => setRows([])).finally(() => setLoading(false)) }, [])
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-lg" style={{ color: NAVY }}>Historial de administración</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5">
          {loading && <p className="text-center py-6 text-gray-400 text-sm">Cargando…</p>}
          {!loading && rows.length === 0 && <p className="text-center py-6 text-gray-300 text-sm">Sin registros.</p>}
          {rows.map(r => (
            <div key={r.id} className="py-2 border-b border-gray-50 last:border-0 text-sm">
              <span className="text-gray-400 text-xs">{fmtFecha(r.created_at)}</span>
              <p className="text-gray-700"><b>{r.actor}</b> {r.action} <b>{r.target}</b>{r.detail ? ` · ${r.detail}` : ''}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
