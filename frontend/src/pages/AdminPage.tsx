import { useEffect, useState } from 'react'
import { adminApi, dataApi } from '../services/api'
import { KPICard, PageHeader, Section, SyntheticBanner } from '../components/Common'
import { StatusBadge } from '../components/Badge'

export function AdminPage() {
  const [users, setUsers] = useState<any[]>([])
  const [status, setStatus] = useState<any>(null)
  const [sources, setSources] = useState<any[]>([])

  useEffect(() => {
    adminApi.users().then((d) => setUsers(d.users))
    adminApi.systemStatus().then(setStatus)
    dataApi.sources().then((d) => setSources(d.sources))
  }, [])

  return (
    <div>
      <PageHeader title="Admin" description="User management, roles, data sources, system status and model configuration." />
      <SyntheticBanner />

      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KPICard label="Demo Mode" value={status.demo_mode ? 'ON' : 'OFF'} />
          <KPICard label="Sources Connected" value={`${status.sources_connected}/${status.sources_total}`} />
          <KPICard label="Total Records" value={status.total_records_loaded} />
          <KPICard label="LLM Provider" value={status.llm_provider_configured ? 'Configured' : 'Not configured (demo NLP)'} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="User Management">
          <table className="data-table">
            <thead><tr><th>Username</th><th>Name</th><th>Role</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}><td>{u.username}</td><td>{u.name}</td><td><StatusBadge value={u.role} /></td></tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="System Status">
          <div className="flex flex-col gap-2 text-sm">
            <div>Database: <span style={{ color: 'var(--text-500)' }}>{status?.database}</span></div>
            <div>Graph Engine: <span style={{ color: 'var(--text-500)' }}>{status?.graph_engine}</span></div>
            <div>Last Loaded: <span style={{ color: 'var(--text-500)' }}>{status?.last_loaded ? new Date(status.last_loaded).toLocaleString() : '—'}</span></div>
          </div>
        </Section>

        <Section title="Data Sources">
          <table className="data-table">
            <thead><tr><th>Source</th><th>Status</th><th>Records</th></tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}><td>{s.label}</td><td><StatusBadge value={s.connected ? 'VERIFIED' : 'UNVERIFIED'} /></td><td>{s.record_count}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Model Configuration">
          <div className="flex flex-col gap-2 text-sm">
            <div>NLP Mode: <StatusBadge value="Deterministic Demo Mode" /></div>
            <div>Graph Analytics: <StatusBadge value="NetworkX (local)" /></div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-500)' }}>
              An external LLM provider can be plugged in later without breaking demo mode — the app degrades gracefully
              if no API key is configured.
            </p>
          </div>
        </Section>
      </div>
    </div>
  )
}
