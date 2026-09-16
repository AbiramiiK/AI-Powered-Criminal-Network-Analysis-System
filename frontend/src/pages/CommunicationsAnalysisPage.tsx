import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KPICard, LoadingState, PageHeader, Section, SyntheticBanner } from '../components/Common'
import { analyticsApi } from '../services/api'

export function CommunicationsAnalysisPage() {
  const [data, setData] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => { analyticsApi.communications().then(setData) }, [])

  if (!data) return <LoadingState label="Loading communication analytics…" />

  return (
    <div>
      <PageHeader title="Communication Analysis" description="Call/SMS frequency, duration, and network communities." />
      <SyntheticBanner />

      <div className="p-3 rounded-lg text-xs font-semibold mb-4" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}>
        {data.disclaimer}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <KPICard label="Total Calls / SMS" value={data.total_calls} />
        <KPICard label="Avg Duration" value={`${Math.round(data.avg_duration_seconds)}s`} />
        <KPICard label="Voice vs SMS" value={Object.entries(data.by_communication_type).map(([k, v]) => `${k}: ${v}`).join(' · ')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Most Connected Pairs">
          <table className="data-table">
            <thead><tr><th>Person A</th><th>Person B</th><th>Contact Count</th></tr></thead>
            <tbody>
              {data.most_connected_pairs.map((p: any, i: number) => (
                <tr key={i}><td className="cursor-pointer" onClick={() => navigate(`/entities/person/${p.person_a}`)}>{p.person_a_name}</td>
                  <td className="cursor-pointer" onClick={() => navigate(`/entities/person/${p.person_b}`)}>{p.person_b_name}</td>
                  <td>{p.count}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="Most Active Persons">
          <table className="data-table">
            <thead><tr><th>Person</th><th>Total Contacts</th></tr></thead>
            <tbody>
              {data.most_active_persons.map((p: any) => (
                <tr key={p.person_id} className="cursor-pointer" onClick={() => navigate(`/entities/person/${p.person_id}`)}>
                  <td>{p.name}</td><td>{p.call_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  )
}
