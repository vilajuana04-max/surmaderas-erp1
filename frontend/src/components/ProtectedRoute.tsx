import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { can, firstAllowedPath, Level } from '../permissions'

interface Props {
  children: React.ReactNode
  module?:  string   // módulo requerido; si se omite, cualquier usuario logueado
  level?:   Level    // nivel mínimo (default 'view')
}

function SessionLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/40 text-xs tracking-widest uppercase">Sur Maderas</p>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children, module, level = 'view' }: Props) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <SessionLoader />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Sin módulo requerido → cualquier usuario autenticado (ej: Mi cuenta)
  if (!module) return <>{children}</>

  // Verificación por permiso de módulo
  if (!can(user.permissions, module, level)) {
    return <Navigate to={firstAllowedPath(user.permissions)} replace />
  }

  return <>{children}</>
}
