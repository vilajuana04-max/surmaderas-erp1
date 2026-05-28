import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type UserRole = 'admin' | 'caja'

export interface AuthUser {
  id:       number
  username: string
  role:     UserRole
}

interface AuthState {
  user:    AuthUser | null
  token:   string | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login:  (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY  = 'erp_token'
const USER_KEY     = 'erp_user'
const BASE         = import.meta.env.VITE_API_URL ?? ''

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [token,   setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(STORAGE_KEY)
      const savedUser  = localStorage.getItem(USER_KEY)
      if (savedToken && savedUser) {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      }
    } catch {
      // Corrupt storage — ignore
    } finally {
      setLoading(false)
    }
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

    localStorage.setItem(STORAGE_KEY, data.access_token)
    localStorage.setItem(USER_KEY,    JSON.stringify(authUser))
    setToken(data.access_token)
    setUser(authUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Stored token — used by the API client */
export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}
