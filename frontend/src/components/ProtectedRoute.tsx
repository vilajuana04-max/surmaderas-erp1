import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, UserRole } from '../context/AuthContext'

interface Props {
  children:      React.ReactNode
  requiredRole?: UserRole   // if omitted, any logged-in user can access
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

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Restoring session from localStorage → show spinner instead of blank screen
  if (loading) return <SessionLoader />

  // Not logged in → send to /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // caja_diaria: caja diaria, cupones y base de datos de clientes
  const CAJA_DIARIA_ALLOWED = ['/caja-diaria', '/cupones', '/clientes']
  if (user.role === 'caja_diaria' && !CAJA_DIARIA_ALLOWED.includes(location.pathname)) {
    return <Navigate to="/caja-diaria" replace />
  }

  // cupones: acceso a Cupones y base de datos de clientes
  const CUPONES_ALLOWED = ['/cupones', '/clientes']
  if (user.role === 'cupones' && !CUPONES_ALLOWED.includes(location.pathname)) {
    return <Navigate to="/cupones" replace />
  }

  // Logged in but not enough permissions → send to /
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
