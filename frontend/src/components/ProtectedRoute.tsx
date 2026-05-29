import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, UserRole } from '../context/AuthContext'

interface Props {
  children:      React.ReactNode
  requiredRole?: UserRole   // if omitted, any logged-in user can access
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Still restoring session from localStorage
  if (loading) return null

  // Not logged in → send to /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // caja_diaria: solo puede estar en /caja-diaria
  if (user.role === 'caja_diaria' && location.pathname !== '/caja-diaria') {
    return <Navigate to="/caja-diaria" replace />
  }

  // Logged in but not enough permissions → send to /
  if (requiredRole && user.role !== requiredRole && user.role !== 'caja_diaria') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
