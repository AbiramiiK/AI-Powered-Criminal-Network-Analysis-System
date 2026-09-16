import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { timelineApi, casesApi } from '../services/api'
import { LoadingState, PageHeader, Section, SyntheticBanner, EmptyState } from '../components/Common'

const EVENT_TYPES = [
  'CALL_DETECTED', 'TRANSACTION_DETECTED', 'LOCATION_OBSERVED', 'FIR_REGISTERED',
  'INTELLIGENCE_RECEIVED', 'EVIDENCE_COLLECTED', 'ALERT_GENERATED', 'ANALYST_REVIEW',
  'INVESTIGATION_UPDATE', 'ENTITY_LINKED', 'VEHICLE_OBSERVED',
]

const SOURCE_COLORS: Record<string, string> = {
  CDR: '#2563EB', TRANSACTIONS: '#F59E0B', LOCATION_RECORDS: '#16A34A',
  FIR: '#DC2626', INTEL_REPORT: '#7C3AED', EVIDENCE: '#0EA5E9', INVESTIGATION_EVENT: '#173F67',
}

export function TimelinePage() {
  const [urlParams] = useSearchParams()
  const [cases, setCases] = useState<any[]>([])
  const [caseId, setCaseId] = useState('')
  const [personId, setPersonId] = useState(urlParams.get('person_id') ?? '')
  const [eventType, setEventType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [data, setData] = useState<any>(null)

  useEffect(() => { casesApi.list().then((d) => setCases(d.cases)) }, [])

  useEffect(() => {
    const params: Record<string, string> = {}
    if (caseId) params.case_id = caseId
    if (personId) params.person_id = personId
    if (eventType) params.event_type = eventType
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    timelineApi.get(params).then(setData)
  }, [caseId, personId, eventType, startDate, endDate])

  const monthCounts = useMemo(() => {
    if (!data) return []
    const map: Record<string, number> = {}
    for (const e of data.events) {
      const month = (e.timestamp || '').slice(0, 7)
      if (!month) continue
      map[month] = (map[month] || 0) + 1
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }))
  }, [data])

  return (
    <div>
      <PageHeader title="Timeline" description="Chronological view of communications, transactions, locations, FIRs, intelligence and evidence." />
      <SyntheticBanner />

      <div className="card p-3 mb-4 flex flex-wrap gap-2">
        <select className="input text-sm" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          <option value="">All cases</option>
          {cases.map((c) => <option key={c.case_id} value={c.case_id}>{c.case_id} — {c.case_title}</option>)}
        </select>
        <input className="input text-sm" placeholder="Person ID (e.g. P001)" value={personId} onChange={(e) => setPersonId(e.target.value)} />
        <select className="input text-sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <input type="date" className="input text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" className="input text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      {!data ? <LoadingState label="Loading timeline…" /> : (
        <>
          <Section title={`Events Over Time (${data.count} total)`}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAF4FF" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#173F67" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <div className="card p-4 mt-4">
            {data.events.length === 0 && <EmptyState label="No events match the current filters." />}
            <ol className="flex flex-col gap-0">
              {data.events.slice(0, 300).map((e: any, i: number) => (
                <li key={i} className="flex gap-3 text-xs py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="w-40 shrink-0" style={{ color: 'var(--text-500)' }}>{e.timestamp ? new Date(e.timestamp).toLocaleString() : e.timestamp}</span>
                  <span className="badge shrink-0" style={{ background: (SOURCE_COLORS[e.source] ?? '#64748B') + '22', color: SOURCE_COLORS[e.source] ?? '#64748B' }}>
                    {e.source}
                  </span>
                  <span className="flex-1" style={{ color: 'var(--text-700)' }}>{e.description}</span>
                </li>
              ))}
            </ol>
            {data.events.length > 300 && <p className="text-xs mt-2" style={{ color: 'var(--text-500)' }}>Showing first 300 of {data.events.length} events. Narrow filters to see more detail.</p>}
          </div>
        </>
      )}
    </div>
  )
}
