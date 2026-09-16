import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { casesApi } from '../services/api'
import { LoadingState, PageHeader, Section, SyntheticBanner } from '../components/Common'
import { StatusBadge } from '../components/Badge'
import { NetworkGraph } from '../graph/NetworkGraph'

const TABS = ['Overview', 'Persons of Interest', 'Network', 'Timeline', 'Alerts', 'Evidence', 'Intelligence', 'Transactions', 'Locations', 'Vehicles', 'Patterns']

export function CaseDetailPage() {
  const { caseId } = useParams()
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState('Overview')
  const navigate = useNavigate()

  useEffect(() => {
    if (caseId) casesApi.get(caseId).then(setData)
  }, [caseId])

  if (!data) return <LoadingState label="Loading case…" />

  const { case: c, persons_of_interest, alerts, timeline, evidence, intelligence, transactions, locations, vehicles, network_patterns } = data

  const poiIds = new Set(persons_of_interest.map((p: any) => p.person_id))
  const caseGraphNodes = [
    { id: c.case_id, label: c.case_title, type: 'CASE', degree: persons_of_interest.length },
    ...persons_of_interest.map((p: any) => ({ id: p.person_id, label: p.full_name, type: 'PERSON', degree: 2 })),
  ]
  const caseGraphEdges = persons_of_interest.map((p: any, i: number) => ({
    id: `poi-${i}`, source: p.person_id, target: c.case_id, relation: 'ASSOCIATED_WITH', count: 1, label: 'POI of',
  }))
  for (const pat of network_patterns) {
    for (let i = 0; i < pat.entities.length - 1; i++) {
      if (poiIds.has(pat.entities[i]) && poiIds.has(pat.entities[i + 1])) {
        caseGraphEdges.push({
          id: `pat-${pat.pattern_type}-${i}-${Math.random()}`, source: pat.entities[i], target: pat.entities[i + 1],
          relation: pat.pattern_type, count: 1, label: pat.pattern_type,
        })
      }
    }
  }

  return (
    <div>
      <button onClick={() => navigate('/cases')} className="flex items-center gap-1 text-xs mb-3" style={{ color: 'var(--navy-800)' }}>
        <ArrowLeft size={13} /> Back to Cases
      </button>
      <PageHeader
        title={c.case_title}
        description={`${c.case_id} · ${c.region} · Opened ${c.opening_date}`}
        right={<><StatusBadge value={c.priority_level} /><StatusBadge value={c.status} /></>}
      />
      <SyntheticBanner />

      <div className="flex gap-1 mb-4 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors"
            style={{
              borderColor: tab === t ? 'var(--navy-800)' : 'transparent',
              color: tab === t ? 'var(--navy-900)' : 'var(--text-500)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <Section title="Case Information">
          <p className="text-sm mb-3" style={{ color: 'var(--text-700)' }}>{c.description}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><div style={{ color: 'var(--text-500)' }}>Crime Category</div><div className="font-semibold">{c.crime_category}</div></div>
            <div><div style={{ color: 'var(--text-500)' }}>Region</div><div className="font-semibold">{c.region}</div></div>
            <div><div style={{ color: 'var(--text-500)' }}>Opened</div><div className="font-semibold">{c.opening_date}</div></div>
            <div><div style={{ color: 'var(--text-500)' }}>Persons of Interest</div><div className="font-semibold">{persons_of_interest.length}</div></div>
          </div>
        </Section>
      )}

      {tab === 'Persons of Interest' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {persons_of_interest.map((p: any) => (
            <button key={p.person_id} onClick={() => navigate(`/entities/person/${p.person_id}`)} className="card p-4 text-left hover:shadow-md">
              <div className="text-sm font-bold" style={{ color: 'var(--navy-900)' }}>{p.full_name}</div>
              <div className="text-xs" style={{ color: 'var(--text-500)' }}>{p.person_id} · alias {p.primary_alias}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-500)' }}>{p.organization} · {p.address_zone}</div>
            </button>
          ))}
        </div>
      )}

      {tab === 'Network' && (
        <Section title="Case Network">
          <NetworkGraph data={{ nodes: caseGraphNodes as any, edges: caseGraphEdges as any }} height={480} onNodeClick={(id, type) => {
            if (type === 'PERSON') navigate(`/entities/person/${id}`)
          }} />
        </Section>
      )}

      {tab === 'Timeline' && (
        <Section title="Case Timeline">
          <ol className="flex flex-col gap-3">
            {timeline.map((e: any) => (
              <li key={e.event_id} className="flex gap-3 text-xs">
                <span className="w-36 shrink-0" style={{ color: 'var(--text-500)' }}>{new Date(e.event_timestamp).toLocaleString()}</span>
                <div>
                  <span className="font-semibold" style={{ color: 'var(--navy-900)' }}>{e.event_type.replace(/_/g, ' ')}</span>
                  <p style={{ color: 'var(--text-700)' }}>{e.event_description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {tab === 'Alerts' && (
        <Section title="Alerts">
          <table className="data-table">
            <thead><tr><th>Severity</th><th>Type</th><th>Person</th><th>Related</th><th>Explanation</th><th>Status</th></tr></thead>
            <tbody>
              {alerts.map((a: any) => (
                <tr key={a.alert_id}>
                  <td><StatusBadge value={a.severity} /></td>
                  <td>{a.alert_type.replace(/_/g, ' ')}</td>
                  <td>{a.person_id}</td>
                  <td>{a.related_person_id}</td>
                  <td className="max-w-md">{a.explanation}</td>
                  <td><StatusBadge value={a.analyst_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === 'Evidence' && (
        <Section title="Evidence">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Type</th><th>Person</th><th>Status</th><th>Confidence</th><th>Description</th></tr></thead>
            <tbody>
              {evidence.map((e: any) => (
                <tr key={e.evidence_id}>
                  <td className="font-mono">{e.evidence_id}</td>
                  <td>{e.evidence_type}</td>
                  <td>{e.person_id}</td>
                  <td><StatusBadge value={e.evidence_status} /></td>
                  <td>{Math.round(Number(e.confidence_score) * 100)}%</td>
                  <td className="max-w-md">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === 'Intelligence' && (
        <Section title="Intelligence Reports">
          <div className="flex flex-col gap-2">
            {intelligence.map((i: any) => (
              <div key={i.intelligence_id} className="p-3 rounded-lg" style={{ background: 'var(--blue-50)' }}>
                <div className="flex items-center gap-2 text-xs mb-1">
                  <StatusBadge value={i.verification_status} />
                  <span style={{ color: 'var(--text-500)' }}>{i.source_type} · reliability {i.reliability_level} · {i.report_date}</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-700)' }}>{i.information_text}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === 'Transactions' && (
        <Section title="Financial Transactions">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Sender</th><th>Receiver</th><th>Amount</th><th>Pattern</th><th>Timestamp</th></tr></thead>
            <tbody>
              {transactions.map((t: any) => (
                <tr key={t.transaction_id}>
                  <td className="font-mono">{t.transaction_id}</td>
                  <td>{t.sender_id}</td><td>{t.receiver_id}</td>
                  <td>INR {Number(t.amount).toLocaleString()}</td>
                  <td><StatusBadge value={t.pattern_label} /></td>
                  <td>{t.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === 'Locations' && (
        <Section title="Location Records">
          <table className="data-table">
            <thead><tr><th>Person</th><th>Location</th><th>Type</th><th>Timestamp</th></tr></thead>
            <tbody>
              {locations.map((l: any, i: number) => (
                <tr key={i}>
                  <td>{l.person_id}</td><td>{l.location_name}</td><td>{l.observation_type}</td><td>{l.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === 'Vehicles' && (
        <Section title="Vehicles Owned by POIs">
          <table className="data-table">
            <thead><tr><th>Vehicle</th><th>Registration</th><th>Type</th><th>Owner</th><th>Color</th></tr></thead>
            <tbody>
              {vehicles.map((v: any) => (
                <tr key={v.vehicle_id}>
                  <td className="font-mono">{v.vehicle_id}</td><td>{v.registration_id}</td><td>{v.vehicle_type}</td>
                  <td>{v.primary_owner_id}</td><td>{v.color_description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === 'Patterns' && (
        <Section title="Detected Network Patterns Involving This Case">
          <div className="flex flex-col gap-2">
            {network_patterns.length === 0 && <p className="text-sm" style={{ color: 'var(--text-500)' }}>No high-confidence patterns detected for this case's persons of interest.</p>}
            {network_patterns.map((p: any, i: number) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--blue-50)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold" style={{ color: 'var(--navy-900)' }}>{p.pattern_type.replace(/_/g, ' ')}</span>
                  <span className="text-xs" style={{ color: 'var(--text-500)' }}>confidence {Math.round(p.confidence * 100)}%</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-700)' }}>{p.explanation}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
