import { useEffect, useState } from 'react'
import { entitiesApi } from '../services/api'
import { LoadingState, PageHeader, Section, SyntheticBanner, ConfidenceBar, EmptyState } from '../components/Common'

export function EntityResolutionPage() {
  const [candidates, setCandidates] = useState<any[] | null>(null)
  const [decisions, setDecisions] = useState<Record<string, string>>({})
  const [threshold, setThreshold] = useState(0.3)

  function load() {
    entitiesApi.resolutionCandidates(threshold).then((d) => setCandidates(d.candidates))
  }

  useEffect(() => { load() }, [threshold])

  async function act(c: any, action: string) {
    await entitiesApi.review({ person_a: c.person_a.person_id, person_b: c.person_b.person_id, action })
    setDecisions((prev) => ({ ...prev, [`${c.person_a.person_id}-${c.person_b.person_id}`]: action }))
  }

  if (!candidates) return <LoadingState label="Running entity resolution…" />

  return (
    <div>
      <PageHeader
        title="Entity Resolution"
        description="Detects possible duplicate / alias identities using fuzzy name matching, shared identifiers, organization and location overlap. High-impact merges always require human review."
      />
      <SyntheticBanner />

      <div className="card p-3 mb-4 flex items-center gap-3">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-700)' }}>Min. confidence: {Math.round(threshold * 100)}%</span>
        <input type="range" min={0} max={0.95} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-48" />
      </div>

      {candidates.length === 0 && <EmptyState label="No potential duplicate identities found at this confidence threshold — consistent with this dataset's clean, pre-resolved canonical person records." />}

      <div className="flex flex-col gap-3">
        {candidates.map((c) => {
          const key = `${c.person_a.person_id}-${c.person_b.person_id}`
          const decision = decisions[key]
          return (
            <Section key={key} title="Possible Match">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-sm font-bold" style={{ color: 'var(--navy-900)' }}>{c.person_a.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-500)' }}>{c.person_a.person_id}</div>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-500)' }}>vs</span>
                  <div>
                    <div className="text-sm font-bold" style={{ color: 'var(--navy-900)' }}>{c.person_b.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-500)' }}>{c.person_b.person_id}</div>
                  </div>
                </div>
                <ConfidenceBar value={c.confidence} />
              </div>

              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-700)' }}>Reasons:</p>
              <ul className="list-disc pl-5 text-xs mb-3" style={{ color: 'var(--text-700)' }}>
                {c.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>

              {decision ? (
                <div className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Recorded decision: {decision}</div>
              ) : (
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => act(c, 'REVIEW')}>Review</button>
                  <button className="btn-primary" onClick={() => act(c, 'MERGE')}>Merge</button>
                  <button className="btn-secondary" onClick={() => act(c, 'REJECT')}>Reject</button>
                </div>
              )}
            </Section>
          )
        })}
      </div>
    </div>
  )
}
