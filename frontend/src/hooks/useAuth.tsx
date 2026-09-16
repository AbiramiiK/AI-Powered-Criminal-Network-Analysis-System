import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi, type Session } from '../services/api'

interface AuthContextValue {
  session: Session | null
  login: (username: string, password: string) => Promise<Session>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem('cnas_session')
    if (raw) {
      try {
        setSession(JSON.parse(raw))
      } catch {
        localStorage.removeItem('cnas_session')
      }
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    const result = await authApi.login(username, password)
    localStorage.setItem('cnas_token', result.token)
    localStorage.setItem('cnas_session', JSON.stringify(result))
    setSession(result)
    return result
  }

  const logout = () => {
    localStorage.removeItem('cnas_token')
    localStorage.removeItem('cnas_session')
    setSession(null)
  }

  return <AuthContext.Provider value={{ session, login, logout, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
