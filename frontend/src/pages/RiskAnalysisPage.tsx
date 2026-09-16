import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyticsApi } from '../services/api'
import { LoadingState, PageHeader, SyntheticBanner } from '../components/Common'
import { StatusBadge } from '../components/Badge'

export function RiskAnalysisPage() {
  const [data, setData] = useState<any>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => { analyticsApi.risk(20).then(setData) }, [])

  if (!data) return <LoadingState label="Computing investigative priority scores…" />

  return (
    <div>
      <PageHeader title="Risk & Influence Analysis" description="Explainable Investigative Priority Score — not a criminal-probability score." />
      <SyntheticBanner />

      <div className="p-3 rounded-lg text-xs font-semibold mb-4" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
        A network connection is NOT proof of criminal activity. A centrality score is NOT proof of leadership.
        These scores exist to help investigators prioritize review, not to make determinations.
      </div>

      <div className="flex flex-col gap-3">
        {data.scores.map((s: any) => (
          <div key={s.person_id} className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                  style={{ background: s.investigative_priority_score >= 70 ? 'var(--danger)' : s.investigative_priority_score >= 40 ? 'var(--warning)' : 'var(--success)' }}
                >
                  {s.investigative_priority_score}
                </div>
                <div>
                  <button className="text-sm font-bold hover:underline" style={{ color: 'var(--navy-900)' }} onClick={() => navigate(`/entities/person/${s.person_id}`)}>
                    {s.name}
                  </button>
                  <div className="text-xs" style={{ color: 'var(--text-500)' }}>{s.person_id} · Investigative Priority Score: {s.investigative_priority_score}/100</div>
                </div>
              </div>
              <button className="btn-secondary text-xs" onClick={() => setExpanded(expanded === s.person_id ? null : s.person_id)}>
                {expanded === s.person_id ? 'Hide factors' : 'Show factors'}
              </button>
            </div>

            {expanded === s.person_id && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  {s.factors.map((f: any) => (
                    <div key={f.factor} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: 'var(--blue-50)' }}>
                      <div>
                        <div className="font-semibold">{f.factor}</div>
                        <div style={{ color: 'var(--text-500)' }}>{f.detail}</div>
                      </div>
                      <StatusBadge value={f.level} />
                    </div>
                  ))}
                </div>
                <p className="text-xs italic" style={{ color: 'var(--text-500)' }}>{s.disclaimer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
