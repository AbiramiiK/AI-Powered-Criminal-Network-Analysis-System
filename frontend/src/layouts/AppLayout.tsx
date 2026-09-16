import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, Share2, Users, GitMerge, Database, Clock, Sparkles,
  Bot, Gauge, Bell, FileText, ScrollText, Settings, LogOut, Shield, Search,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'
import { GlobalSearch } from '../components/GlobalSearch'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cases', label: 'Cases', icon: Briefcase },
  { to: '/network', label: 'Network Analysis', icon: Share2 },
  { to: '/entities', label: 'Entities', icon: Users },
  { to: '/entity-resolution', label: 'Entity Resolution', icon: GitMerge },
  { to: '/data-sources', label: 'Data Sources', icon: Database },
  { to: '/timeline', label: 'Timeline', icon: Clock },
  { to: '/analytics/patterns', label: 'Pattern Analysis', icon: Sparkles },
  { to: '/ai-analysis', label: 'AI / NLP Analysis', icon: Bot },
  { to: '/analytics/risk', label: 'Risk & Influence', icon: Gauge },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/audit', label: 'Audit Logs', icon: ScrollText },
  { to: '/admin', label: 'Settings / Admin', icon: Settings },
]

export function AppLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="flex h-screen" style={{ background: 'var(--blue-50)' }}>
      <aside className="w-60 shrink-0 flex flex-col" style={{ background: 'var(--navy-900)' }}>
        <div className="px-4 py-4 flex items-center gap-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Shield size={20} color="#7FB2E5" />
          <div>
            <div className="text-white text-sm font-bold leading-tight">Criminal Network<br />Analysis System</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'text-white' : 'text-blue-100/70 hover:text-white hover:bg-white/5'
                }`
              }
              style={({ isActive }) => (isActive ? { background: 'var(--navy-700)' } : {})}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 text-blue-100 text-xs mb-2">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} />
            {session?.name} · <span className="font-semibold">{session?.role}</span>
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="flex items-center gap-2 text-xs text-blue-100/70 hover:text-white w-full px-2 py-1.5 rounded-md hover:bg-white/5"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b bg-white" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setSearchOpen(true)}
            className="input flex items-center gap-2 text-sm w-80 text-left"
            style={{ color: 'var(--text-500)' }}
          >
            <Search size={14} /> Search persons, cases, vehicles, locations…
          </button>
          <div className="text-xs" style={{ color: 'var(--text-500)' }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
