import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { casesApi } from '../services/api'
import { LoadingState, PageHeader, SyntheticBanner } from '../components/Common'
import { StatusBadge } from '../components/Badge'

export function CasesPage() {
  const [params, setParams] = useSearchParams()
  const [cases, setCases] = useState<any[] | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [priority, setPriority] = useState('')
  const [region, setRegion] = useState(params.get('region') ?? '')
  const [category, setCategory] = useState(params.get('category') ?? '')
  const navigate = useNavigate()

  const drillDownActive = Boolean(params.get('status') || params.get('region') || params.get('category'))

  function clearDrillDown() {
    setStatus(''); setRegion(''); setCategory('')
    setParams({})
  }

  function load() {
    const params: Record<string, string> = {}
    if (q) params.q = q
    if (status) params.status = status
    if (priority) params.priority = priority
    if (region) params.region = region
    if (category) params.crime_category = category
    casesApi.list(params).then((d) => setCases(d.cases))
  }

  useEffect(() => { load() }, [status, priority, region, category])
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [q])

  if (!cases) return <LoadingState label="Loading cases…" />

  const categories = [...new Set(cases.map((c) => c.crime_category))]
  const regions = [...new Set(cases.map((c) => c.region))]

  return (
    <div>
      <PageHeader title="Cases" description="All investigation cases derived from the case management dataset." />
      <SyntheticBanner />

      {drillDownActive && (
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}>
          Filtered from Dashboard drill-down
          <button onClick={clearDrillDown} className="flex items-center gap-1 ml-auto btn-secondary !py-1 !px-2"><X size={12} /> Clear</button>
        </div>
      )}

      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="input flex items-center gap-2 flex-1 min-w-[220px]">
          <Search size={14} style={{ color: 'var(--text-500)' }} />
          <input className="flex-1 outline-none text-sm" placeholder="Search title, ID, description…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['OPEN', 'ACTIVE_ANALYSIS', 'UNDER_REVIEW', 'CLOSED'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input text-sm" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">All regions</option>
          {regions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {cases.map((c) => (
          <button key={c.case_id} onClick={() => navigate(`/cases/${c.case_id}`)} className="card p-4 text-left hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono" style={{ color: 'var(--text-500)' }}>{c.case_id}</span>
              <StatusBadge value={c.priority_level} />
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--navy-900)' }}>{c.case_title}</h3>
            <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--text-500)' }}>{c.description}</p>
            <div className="flex items-center justify-between text-xs">
              <StatusBadge value={c.status} />
              <span style={{ color: 'var(--text-500)' }}>{c.crime_category}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-500)' }}>{c.poi_list?.length ?? 0} POIs</span>
              <span style={{ color: 'var(--text-500)' }}>{c.alert_count} alerts · {c.event_count} events</span>
            </div>
          </button>
        ))}
      </div>
      {cases.length === 0 && <p className="text-sm text-center py-10" style={{ color: 'var(--text-500)' }}>No cases match the current filters.</p>}
    </div>
  )
}
