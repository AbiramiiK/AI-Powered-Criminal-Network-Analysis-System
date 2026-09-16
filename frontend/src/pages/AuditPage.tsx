import { useEffect, useState } from 'react'
import { adminApi } from '../services/api'
import { LoadingState, PageHeader, SyntheticBanner } from '../components/Common'
import { StatusBadge } from '../components/Badge'

export function AuditPage() {
  const [logs, setLogs] = useState<any[] | null>(null)

  useEffect(() => {
    adminApi.auditLogs().then((d) => setLogs(d.logs))
    const interval = setInterval(() => adminApi.auditLogs().then((d) => setLogs(d.logs)), 5000)
    return () => clearInterval(interval)
  }, [])

  if (!logs) return <LoadingState label="Loading audit logs…" />

  return (
    <div>
      <PageHeader title="Audit Logs" description="Tracks user activity across the system to prevent unauthorized access and support accountability." />
      <SyntheticBanner />

      <div className="card p-0 overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Case</th><th>Entity</th><th>Result</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.timestamp).toLocaleString()}</td>
                <td>{l.user}</td>
                <td><StatusBadge value={l.role} /></td>
                <td>{l.action.replace(/_/g, ' ')}</td>
                <td>{l.case_id ?? '—'}</td>
                <td>{l.entity ?? '—'}</td>
                <td><StatusBadge value={l.result} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="text-sm text-center py-8" style={{ color: 'var(--text-500)' }}>No activity recorded yet in this session. Browse cases, entities and reports to generate audit entries.</p>}
      </div>
    </div>
  )
}
