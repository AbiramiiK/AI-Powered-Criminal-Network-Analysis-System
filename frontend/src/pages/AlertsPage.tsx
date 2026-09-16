import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alertsApi } from '../services/api'
import { LoadingState, PageHeader, SyntheticBanner, ConfidenceBar, EmptyState } from '../components/Common'
import { StatusBadge } from '../components/Badge'

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const STATUSES = ['NEW', 'UNDER_REVIEW', 'CONFIRMED_PATTERN', 'DISMISSED']

export function AlertsPage() {
  const [alerts, setAlerts] = useState<any[] | null>(null)
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('')
  const [alertType, setAlertType] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const navigate = useNavigate()

  function load() {
    const params: Record<string, string> = {}
    if (severity) params.severity = severity
    if (status) params.analyst_status = status
    if (alertType) params.alert_type = alertType
    alertsApi.list(params).then((d) => setAlerts(d.alerts))
  }

  useEffect(() => { load() }, [severity, status, alertType])

  async function updateStatus(id: string, newStatus: string) {
    await alertsApi.updateStatus(id, newStatus)
    load()
  }

  if (!alerts) return <LoadingState label="Loading alerts…" />

  const alertTypes = [...new Set(alerts.map((a) => a.alert_type))]

  return (
    <div>
      <PageHeader title="Alerts" description="Analytical alerts derived from multi-source patterns. Every alert requires analyst review." />
      <SyntheticBanner />

      <div className="card p-3 mb-4 flex flex-wrap gap-2">
        <select className="input text-sm" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input text-sm" value={alertType} onChange={(e) => setAlertType(e.target.value)}>
          <option value="">All types</option>
          {alertTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {alerts.length === 0 && <EmptyState label="No alerts match the current filters." />}

      <div className="flex flex-col gap-2">
        {alerts.map((a) => (
          <div key={a.alert_id} className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 cursor-pointer" onClick={() => setExpanded(expanded === a.alert_id ? null : a.alert_id)}>
              <div className="flex items-center gap-2">
                <StatusBadge value={a.severity} />
                <span className="text-sm font-semibold" style={{ color: 'var(--navy-900)' }}>{a.alert_type.replace(/_/g, ' ')}</span>
                <span className="text-xs" style={{ color: 'var(--text-500)' }}>{a.person_name} ↔ {a.related_person_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <ConfidenceBar value={Number(a.confidence_score)} />
                <StatusBadge value={a.analyst_status} />
              </div>
            </div>
            {expanded === a.alert_id && (
              <div className="mt-3 pt-3 border-t text-xs flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>
                <p style={{ color: 'var(--text-700)' }}>{a.explanation}</p>
                <div className="flex gap-4" style={{ color: 'var(--text-500)' }}>
                  <span>Case: {a.case_id}</span>
                  <span>Timestamp: {new Date(a.alert_timestamp).toLocaleString()}</span>
                  <span>Supporting sources: {a.supporting_sources_list.join(', ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary" onClick={() => navigate(`/entities/person/${a.person_id}`)}>View {a.person_name}</button>
                  <button className="btn-secondary" onClick={() => navigate(`/cases/${a.case_id}`)}>View Case</button>
                  {STATUSES.filter((s) => s !== a.analyst_status).map((s) => (
                    <button key={s} className="btn-secondary" onClick={() => updateStatus(a.alert_id, s)}>Mark {s.replace(/_/g, ' ')}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
