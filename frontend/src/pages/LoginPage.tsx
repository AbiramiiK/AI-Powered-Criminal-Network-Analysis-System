import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const DEMO_CREDS = [
  { role: 'INVESTIGATOR', username: 'investigator', password: 'investigator123' },
  { role: 'ANALYST', username: 'analyst', password: 'analyst123' },
  { role: 'ADMIN', username: 'admin', password: 'admin123' },
]

export function LoginPage() {
  const [username, setUsername] = useState('investigator')
  const [password, setPassword] = useState('investigator123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) navigate('/dashboard')
  }, [session, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(username, password)
      if (result.role === 'ANALYST') navigate('/analytics/patterns')
      else if (result.role === 'ADMIN') navigate('/admin')
      else navigate('/dashboard')
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--navy-900)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--navy-700)' }}>
            <Shield size={26} color="#7FB2E5" />
          </div>
          <h1 className="text-white font-bold text-lg">Criminal Network Analysis System</h1>
          <p className="text-blue-100/60 text-xs mt-1">Smarter Intelligence, Safer Communities.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-3">
          <h2 className="text-sm font-bold mb-1" style={{ color: 'var(--navy-900)' }}>Sign in to your account</h2>

          <label className="text-xs font-semibold" style={{ color: 'var(--text-700)' }}>Username</label>
          <div className="input flex items-center gap-2">
            <User size={14} style={{ color: 'var(--text-500)' }} />
            <input className="flex-1 outline-none" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <label className="text-xs font-semibold" style={{ color: 'var(--text-700)' }}>Password</label>
          <div className="input flex items-center gap-2">
            <Lock size={14} style={{ color: 'var(--text-500)' }} />
            <input type="password" className="flex-1 outline-none" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--danger)' }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? 'Signing in…' : 'Login'}
          </button>

          <p className="text-[11px] text-center mt-1" style={{ color: 'var(--text-500)' }}>
            Secure · Encrypted · Authorized Access Only
          </p>
        </form>

        <div className="card p-4 mt-3">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--navy-900)' }}>Demo credentials</p>
          <div className="flex flex-col gap-1.5">
            {DEMO_CREDS.map((c) => (
              <button
                key={c.role}
                type="button"
                onClick={() => { setUsername(c.username); setPassword(c.password) }}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md hover:bg-blue-50 text-left"
              >
                <span style={{ color: 'var(--text-700)' }}>{c.role}</span>
                <span style={{ color: 'var(--text-500)' }}>{c.username} / {c.password}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-blue-100/50 mt-4">
          SYNTHETIC DEMONSTRATION DATA — SIH 2026 Prototype
        </p>
      </div>
    </div>
  )
}
