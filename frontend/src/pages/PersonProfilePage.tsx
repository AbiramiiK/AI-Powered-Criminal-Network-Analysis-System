import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Share2 } from 'lucide-react'
import { entitiesApi } from '../services/api'
import { LoadingState, PageHeader, Section, SyntheticBanner, ConfidenceBar } from '../components/Common'
import { StatusBadge } from '../components/Badge'

const TABS = ['Overview', 'Network', 'Communications', 'Transactions', 'Locations', 'Vehicles', 'FIRs', 'Intelligence', 'Evidence', 'Timeline']

export function PersonProfilePage() {
  const { personId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState('Overview')

  useEffect(() => {
    if (personId) entitiesApi.person(personId).then(setData)
  }, [personId])

  if (!data) return <LoadingState label="Loading person profile…" />

  const { profile, aliases, centrality, risk, associated_persons, associated_vehicles, associated_organizations,
    communications, transactions, locations, fir_mentions, intelligence, evidence, alerts, timeline } = data

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs mb-3" style={{ color: 'var(--navy-800)' }}>
        <ArrowLeft size={13} /> Back
      </button>
      <PageHeader
        title={profile.full_name}
        description={`${profile.person_id} · aliases: ${aliases.map((a: any) => a.alias).join(', ') || profile.primary_alias}`}
        right={<button className="btn-primary flex items-center gap-1.5" onClick={() => navigate(`/network/${profile.person_id}`)}><Share2 size={14} /> View in Network</button>}
      />
      <SyntheticBanner />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs mb-1" style={{ color: 'var(--text-500)' }}>Organization</div>
          <div className="text-sm font-semibold">{profile.organization}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs mb-1" style={{ color: 'var(--text-500)' }}>Address Zone</div>
          <div className="text-sm font-semibold">{profile.address_zone}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs mb-1" style={{ color: 'var(--text-500)' }}>Network Role</div>
          <div className="text-sm font-semibold">{centrality?.classification_label}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs mb-1" style={{ color: 'var(--text-500)' }}>Investigative Priority Score</div>
          <div className="text-lg font-bold" style={{ color: risk?.investigative_priority_score >= 70 ? 'var(--danger)' : 'var(--navy-900)' }}>
            {risk?.investigative_priority_score}/100
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2"
            style={{ borderColor: tab === t ? 'var(--navy-800)' : 'transparent', color: tab === t ? 'var(--navy-900)' : 'var(--text-500)' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Associated Persons">
            <div className="flex flex-wrap gap-2">
              {associated_persons.map((p: any) => (
                <button key={p.person_id} onClick={() => navigate(`/entities/person/${p.person_id}`)} className="badge" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}>
                  {p.name}
                </button>
              ))}
              {associated_persons.length === 0 && <span className="text-xs" style={{ color: 'var(--text-500)' }}>None found.</span>}
            </div>
          </Section>
          <Section title="Associated Organizations">
            <div className="flex flex-col gap-1.5">
              {associated_organizations.map((o: any) => (
                <div key={o.organization_id} className="text-xs flex items-center justify-between">
                  <span>{o.organization_name}</span>
                  <StatusBadge value={o.relationship_type} />
                </div>
              ))}
              {associated_organizations.length === 0 && <span className="text-xs" style={{ color: 'var(--text-500)' }}>None found.</span>}
            </div>
          </Section>
          <Section title="Associated Vehicles">
            <div className="flex flex-col gap-1.5 text-xs">
              {associated_vehicles.owned.map((v: any) => <div key={v.vehicle_id}>{v.vehicle_id} ({v.model_label}) — owned</div>)}
              {associated_vehicles.associated.map((v: any) => <div key={v.association_id}>{v.vehicle_id} — {v.relationship_type}</div>)}
            </div>
          </Section>
          <Section title="Investigative Priority Factors">
            <div className="flex flex-col gap-2">
              {risk?.factors.map((f: any) => (
                <div key={f.factor} className="flex items-center justify-between text-xs">
                  <span>{f.factor}</span>
                  <StatusBadge value={f.level} />
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-3" style={{ color: 'var(--text-500)' }}>{risk?.disclaimer}</p>
          </Section>
          <Section title="Alerts">
            <div className="flex flex-col gap-2">
              {alerts.map((a: any) => (
                <div key={a.alert_id} className="text-xs">
                  <StatusBadge value={a.severity} /> <span className="ml-1">{a.explanation}</span>
                </div>
              ))}
              {alerts.length === 0 && <span className="text-xs" style={{ color: 'var(--text-500)' }}>No alerts.</span>}
            </div>
          </Section>
          <Section title="Communication / Transaction Summary">
            <div className="flex flex-col gap-1.5 text-xs">
              <div>Total calls: <b>{communications.total}</b></div>
              <div>Total transactions: <b>{transactions.total}</b> (INR {transactions.total_volume.toLocaleString()})</div>
              <div>FIR mentions: <b>{fir_mentions.length}</b></div>
              <div>Intelligence reports: <b>{intelligence.as_subject.length + intelligence.as_related.length}</b></div>
              <div>Evidence records: <b>{evidence.length}</b></div>
            </div>
          </Section>
        </div>
      )}

      {tab === 'Network' && (
        <Section title="Centrality Explanation">
          <div className="flex flex-col gap-2 text-sm">
            <div>Degree centrality: <b>{centrality.degree_centrality}</b></div>
            <div>Betweenness centrality: <b>{centrality.betweenness_centrality}</b></div>
            <div>PageRank: <b>{centrality.pagerank}</b></div>
            <div>Closeness centrality: <b>{centrality.closeness_centrality}</b></div>
            <ul className="list-disc pl-5 text-xs" style={{ color: 'var(--text-700)' }}>
              {centrality.explanation.map((e: string, i: number) => <li key={i}>{e}</li>)}
            </ul>
            <p className="text-[11px]" style={{ color: 'var(--text-500)' }}>{centrality.disclaimer}</p>
          </div>
        </Section>
      )}

      {tab === 'Communications' && (
        <Section title={`Communications (${communications.total})`}>
          <table className="data-table">
            <thead><tr><th>Caller</th><th>Receiver</th><th>Type</th><th>Duration</th><th>Location</th><th>Timestamp</th></tr></thead>
            <tbody>
              {communications.records.map((c: any) => (
                <tr key={c.call_id}><td>{c.caller_id}</td><td>{c.receiver_id}</td><td>{c.communication_type}</td>
                  <td>{c.duration_seconds}s</td><td>{c.cell_location}</td><td>{c.timestamp}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === 'Transactions' && (
        <Section title={`Transactions (${transactions.total})`}>
          <table className="data-table">
            <thead><tr><th>Sender</th><th>Receiver</th><th>Amount</th><th>Pattern</th><th>Timestamp</th></tr></thead>
            <tbody>
              {transactions.records.map((t: any) => (
                <tr key={t.transaction_id}><td>{t.sender_id}</td><td>{t.receiver_id}</td>
                  <td>INR {Number(t.amount).toLocaleString()}</td><td><StatusBadge value={t.pattern_label} /></td><td>{t.timestamp}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === 'Locations' && (
        <Section title="Location Observations">
          <table className="data-table">
            <thead><tr><th>Location</th><th>Type</th><th>Timestamp</th></tr></thead>
            <tbody>
              {locations.map((l: any, i: number) => (
                <tr key={i}><td>{l.location_name}</td><td>{l.observation_type}</td><td>{l.timestamp}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === 'Vehicles' && (
        <Section title="Vehicles">
          <div className="flex flex-col gap-2 text-sm">
            {associated_vehicles.owned.map((v: any) => (
              <div key={v.vehicle_id} className="p-2 rounded-lg" style={{ background: 'var(--blue-50)' }}>
                {v.vehicle_id} — {v.vehicle_type} {v.model_label}, {v.color_description} (primary owner)
              </div>
            ))}
            {associated_vehicles.associated.map((v: any) => (
              <div key={v.association_id} className="p-2 rounded-lg" style={{ background: 'var(--blue-50)' }}>
                {v.vehicle_id} — {v.relationship_type}
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === 'FIRs' && (
        <Section title="FIR Mentions">
          <div className="flex flex-col gap-2">
            {fir_mentions.map((f: any) => (
              <div key={f.fir_id} className="p-3 rounded-lg" style={{ background: 'var(--blue-50)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-500)' }}>{f.fir_id} · {f.crime_category} · {f.report_date} · {f.location}</div>
                <p className="text-sm">{f.description}</p>
              </div>
            ))}
            {fir_mentions.length === 0 && <span className="text-xs" style={{ color: 'var(--text-500)' }}>No FIR mentions.</span>}
          </div>
        </Section>
      )}

      {tab === 'Intelligence' && (
        <Section title="Intelligence Reports">
          <div className="flex flex-col gap-2">
            {[...intelligence.as_subject, ...intelligence.as_related].map((i: any) => (
              <div key={i.intelligence_id} className="p-3 rounded-lg" style={{ background: 'var(--blue-50)' }}>
                <div className="flex items-center gap-2 text-xs mb-1">
                  <StatusBadge value={i.verification_status} />
                  <span style={{ color: 'var(--text-500)' }}>{i.intelligence_category} · {i.report_date}</span>
                </div>
                <p className="text-sm">{i.information_text}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === 'Evidence' && (
        <Section title="Evidence">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Confidence</th><th>Description</th></tr></thead>
            <tbody>
              {evidence.map((e: any) => (
                <tr key={e.evidence_id}><td className="font-mono">{e.evidence_id}</td><td>{e.evidence_type}</td>
                  <td><StatusBadge value={e.evidence_status} /></td>
                  <td><ConfidenceBar value={Number(e.confidence_score)} /></td><td>{e.description}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === 'Timeline' && (
        <Section title="Timeline">
          <ol className="flex flex-col gap-3">
            {timeline.map((e: any) => (
              <li key={e.event_id} className="flex gap-3 text-xs">
                <span className="w-36 shrink-0" style={{ color: 'var(--text-500)' }}>{new Date(e.event_timestamp).toLocaleString()}</span>
                <div><span className="font-semibold">{e.event_type.replace(/_/g, ' ')}</span><p>{e.event_description}</p></div>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  )
}
