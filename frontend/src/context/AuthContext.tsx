import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Permissions } from '../permissions'

// 'role' ahora es una plantilla libre (Administrador | Caja | Ventas | Personalizado + legacy)
export type UserRole = string

export interface AuthUser {
  id:       number
  username: string
  name?:    string
  role:     UserRole
  branch?:  string | null
  is_primary_admin?: boolean
  permissions?: Permissions
}

interface AuthState {
  user:    AuthUser | null
  token:   string | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login:  (username: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY  = 'erp_token'
const USER_KEY     = 'erp_user'
const BASE         = import.meta.env.VITE_API_URL ?? ''

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [token,   setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const persist = (t: string, u: AuthUser) => {
    localStorage.setItem(STORAGE_KEY, t)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
  }

  // Restaura sesión y la refresca desde /auth/me (para tomar permisos nuevos)
  useEffect(() => {
    const init = async () => {
      let savedToken: string | null = null
      try {
        savedToken = localStorage.getItem(STORAGE_KEY)
        const savedUser = localStorage.getItem(USER_KEY)
        if (savedToken && savedUser) {
          setToken(savedToken)
          setUser(JSON.parse(savedUser))
        }
      } catch { /* storage corrupto */ }

      if (savedToken) {
        try {
          const res = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${savedToken}` } })
          if (res.ok) {
            const fresh: AuthUser = await res.json()
            setUser(fresh)
            localStorage.setItem(USER_KEY, JSON.stringify(fresh))
          } else if (res.status === 401) {
            // Token inválido o usuario pausado → cerrar sesión
            localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(USER_KEY)
            setToken(null); setUser(null)
          }
        } catch { /* sin red (Render dormido) → mantener sesión local */ }
      }
      setLoading(false)
    }
    init()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Error al iniciar sesión')
    }
    const data = await res.json()
    const authUser: AuthUser = data.user
    persist(data.access_token, authUser)
    setToken(data.access_token)
    setUser(authUser)
  }, [])

  const refresh = useCallback(async () => {
    const t = localStorage.getItem(STORAGE_KEY)
    if (!t) return
    try {
      const res = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      if (res.ok) {
        const fresh: AuthUser = await res.json()
        setUser(fresh)
        localStorage.setItem(USER_KEY, JSON.stringify(fresh))
      }
    } catch { /* ignorar */ }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Token almacenado — usado por el cliente API */
export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}
