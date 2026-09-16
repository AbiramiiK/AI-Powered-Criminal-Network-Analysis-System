import { useEffect, useState } from 'react'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ZAxis } from 'recharts'
import { analyticsApi, entitiesApi } from '../services/api'
import { KPICard, LoadingState, PageHeader, Section, SyntheticBanner } from '../components/Common'

export function LocationsAnalysisPage() {
  const [data, setData] = useState<any>(null)
  const [personId, setPersonId] = useState('')
  const [persons, setPersons] = useState<any[]>([])

  useEffect(() => { entitiesApi.list('person').then((d) => setPersons(d.persons)) }, [])
  useEffect(() => { analyticsApi.locations(personId || undefined).then(setData) }, [personId])

  if (!data) return <LoadingState label="Loading location analytics…" />

  const scatterData = (data.movement_timeline ?? []).map((l: any) => ({
    x: Number(l.longitude), y: Number(l.latitude), name: l.location_name, person: l.person_id,
  }))

  return (
    <div>
      <PageHeader title="Location Analysis" description="Movement timeline, frequently visited locations and co-location events." />
      <SyntheticBanner />
      <div className="p-3 rounded-lg text-xs font-semibold mb-4" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}>
        {data.synthetic_notice}
      </div>

      <div className="card p-3 mb-4">
        <select className="input text-sm" value={personId} onChange={(e) => setPersonId(e.target.value)}>
          <option value="">All persons</option>
          {persons.map((p) => <option key={p.person_id} value={p.person_id}>{p.full_name} ({p.person_id})</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <KPICard label="Total Records" value={data.total_records} />
        <KPICard label="Distinct Locations" value={Object.keys(data.frequent_locations ?? {}).length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Spatial Distribution (synthetic coordinates)">
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAF4FF" />
              <XAxis type="number" dataKey="x" name="longitude" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <YAxis type="number" dataKey="y" name="latitude" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <ZAxis range={[60, 60]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(_v, _n, p: any) => [`${p.payload.name} (${p.payload.person})`, '']} />
              <Scatter data={scatterData} fill="#173F67" />
            </ScatterChart>
          </ResponsiveContainer>
        </Section>
        <Section title="Frequently Visited Locations">
          <table className="data-table">
            <thead><tr><th>Location</th><th>Observations</th></tr></thead>
            <tbody>
              {Object.entries(data.frequent_locations ?? {}).map(([name, count]: any) => (
                <tr key={name}><td>{name}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      {!personId && (
        <Section title="Co-Location Pair Counts (Top 10)">
          <table className="data-table">
            <thead><tr><th>Pair</th><th>Shared Location-Days</th></tr></thead>
            <tbody>
              {Object.entries(data.co_location_pair_counts ?? {}).map(([pair, count]: any) => (
                <tr key={pair}><td>{pair}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  )
}
