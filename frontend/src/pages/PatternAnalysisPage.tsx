import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyticsApi } from '../services/api'
import { LoadingState, PageHeader, Section, SyntheticBanner, ConfidenceBar, EmptyState } from '../components/Common'

const CATEGORY_LABELS: Record<string, string> = {
  transaction_chains: 'Transaction Chains',
  circular_flows: 'Circular Transaction Flows',
  repeated_high_value: 'Repeated High-Value Transactions',
  communication_spikes: 'Sudden Communication Spikes',
  frequent_co_location: 'Frequent Co-Location',
  shared_vehicles: 'Shared Vehicle Relationships',
}

export function PatternAnalysisPage() {
  const [data, setData] = useState<any>(null)
  const [active, setActive] = useState('transaction_chains')
  const navigate = useNavigate()

  useEffect(() => { analyticsApi.patterns().then(setData) }, [])

  if (!data) return <LoadingState label="Detecting patterns…" />

  const items = data.patterns[active] ?? []

  return (
    <div>
      <PageHeader title="Pattern Analysis" description={`${data.total_patterns} analytical patterns detected across all datasets. Every pattern is an investigative lead, not a conclusion.`} />
      <SyntheticBanner />

      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: active === key ? 'var(--navy-800)' : 'var(--blue-100)',
              color: active === key ? 'white' : 'var(--navy-800)',
            }}
          >
            {label} ({data.patterns[key]?.length ?? 0})
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {items.length === 0 && <EmptyState label="No patterns of this type were detected." />}
        {items.map((p: any, i: number) => (
          <Section key={i} title={p.pattern_type.replace(/_/g, ' ')} right={<ConfidenceBar value={p.confidence} />}>
            <p className="text-sm mb-2" style={{ color: 'var(--text-700)' }}>{p.explanation}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {p.entity_names.map((name: string, idx: number) => (
                <button key={idx} className="badge" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}
                  onClick={() => navigate(`/entities/person/${p.entities[idx]}`)}>
                  {name}
                </button>
              ))}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-500)' }}>
              Supporting records: {p.supporting_records.slice(0, 6).join(', ')}
              {p.timestamp && <span> · {new Date(p.timestamp).toLocaleString?.() ?? p.timestamp}</span>}
            </div>
            {p.dataset_label_agreement && <div className="text-xs mt-1" style={{ color: 'var(--text-500)' }}>{p.dataset_label_agreement}</div>}
            <div className="mt-2">
              <span className="badge" style={{ background: 'var(--warning-bg)', color: '#92640a' }}>{p.analyst_review_state}</span>
            </div>
          </Section>
        ))}
      </div>
    </div>
  )
}
