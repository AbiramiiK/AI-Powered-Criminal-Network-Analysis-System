import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import {
  Briefcase, Activity, AlertTriangle, Users, Share2, Bell, Search, Upload, FileText,
  Info, CheckCircle2, Database, GitMerge, Clock, ArrowRight,
} from 'lucide-react'
import { dashboardApi, analyticsApi, networkApi } from '../services/api'
import { KPICard, LoadingState, Section } from '../components/Common'
import { StatusBadge } from '../components/Badge'
import { NetworkGraph } from '../graph/NetworkGraph'
import { useAuth } from '../hooks/useAuth'

const PIE_COLORS = ['#173F67', '#2563EB', '#16A34A', '#F59E0B', '#DC2626', '#7C3AED', '#0EA5E9', '#94A3B8']
const STATUS_COLORS: Record<string, string> = {
  OPEN: '#2563EB', ACTIVE_ANALYSIS: '#F59E0B', UNDER_REVIEW: '#7C3AED', CLOSED: '#94A3B8',
}
const SERIES_CONFIG = [
  { key: 'communication', label: 'Communication', color: '#2563EB' },
  { key: 'financial', label: 'Financial', color: '#F59E0B' },
  { key: 'location', label: 'Location', color: '#16A34A' },
  { key: 'intelligence', label: 'Intelligence', color: '#7C3AED' },
  { key: 'investigation', label: 'Investigation', color: '#DC2626' },
]
const SOURCE_COLORS: Record<string, string> = {
  FIR: '#DC2626', CDR: '#2563EB', Transactions: '#F59E0B', Locations: '#16A34A',
  Vehicles: '#EA580C', Intelligence: '#7C3AED', Evidence: '#0EA5E9',
}

function InfoBanner() {
  return (
    <div className="flex items-start gap-2.5 text-xs px-3.5 py-2.5 rounded-lg mb-5"
         style={{ background: 'var(--blue-100)', color: 'var(--navy-800)', border: '1px solid #C9DEF2' }}>
      <Info size={15} className="shrink-0 mt-0.5" />
      <div>
        <span className="font-bold">SYNTHETIC DEMONSTRATION DATA.</span>{' '}
        All person-level investigation records shown in this prototype are fictional and intended only
        for demonstrating analytical workflows.
      </div>
    </div>
  )
}

function HorizontalBarList({ data, colorFor, onSelect }: { data: { label: string; count: number; percentage: number }[]; colorFor: (i: number) => string; onSelect: (label: string) => void }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d, i) => (
        <button key={d.label} onClick={() => onSelect(d.label)} className="w-full text-left group">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium group-hover:underline" style={{ color: 'var(--text-700)' }}>{d.label}</span>
            <span style={{ color: 'var(--text-500)' }}>{d.count} · {d.percentage}%</span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: 'var(--blue-50)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.count / max) * 100}%`, background: colorFor(i) }} />
          </div>
        </button>
      ))}
    </div>
  )
}

function ActivityHeatmap({ cells }: { cells: { day: string; day_index: number; hour: number; count: number }[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const max = Math.max(...cells.map((c) => c.count), 1)
  const lookup = new Map(cells.map((c) => [`${c.day_index}-${c.hour}`, c.count]))

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `32px repeat(24, 12px)` }}>
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="text-[8px] text-center" style={{ color: 'var(--text-500)' }}>{h % 3 === 0 ? h : ''}</div>
        ))}
        {days.map((day, dIdx) => (
          <Fragment key={day}>
            <div className="text-[10px] flex items-center" style={{ color: 'var(--text-500)' }}>{day}</div>
            {Array.from({ length: 24 }).map((_, h) => {
              const count = lookup.get(`${dIdx}-${h}`) ?? 0
              const intensity = count / max
              return (
                <div
                  key={`${day}-${h}`}
                  title={`${day} ${h}:00 — ${count} event(s)`}
                  className="rounded-[2px]"
                  style={{
                    width: 12, height: 12,
                    background: count === 0 ? '#EAF4FF' : `rgba(23, 63, 103, ${0.15 + intensity * 0.85})`,
                  }}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [caseDist, setCaseDist] = useState<any>(null)
  const [activity, setActivity] = useState<any>(null)
  const [alertData, setAlertData] = useState<any>(null)
  const [correlation, setCorrelation] = useState<any>(null)
  const [networkMetrics, setNetworkMetrics] = useState<any>(null)
  const [visibleSeries, setVisibleSeries] = useState<string[]>(SERIES_CONFIG.map((s) => s.key))
  const navigate = useNavigate()
  const { session } = useAuth()

  useEffect(() => {
    dashboardApi.summary().then(setData)
    dashboardApi.caseDistribution().then(setCaseDist)
    dashboardApi.activity().then(setActivity)
    dashboardApi.alerts({ limit: 8 }).then(setAlertData)
    analyticsApi.correlation().then(setCorrelation)
    networkApi.overview(16).then((d) => setNetworkMetrics(d))
  }, [])

  const toggleSeries = (key: string) =>
    setVisibleSeries((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const graphData = useMemo(() => {
    if (!networkMetrics) return { nodes: [], edges: [] }
    return {
      nodes: networkMetrics.nodes.map((n: any) => ({ id: n.id, label: n.label, type: n.type, degree: n.degree, analytical_tags: n.analytical_tags })),
      edges: networkMetrics.edges,
    }
  }, [networkMetrics])

  if (!data || !caseDist || !activity || !alertData || !correlation) return <LoadingState label="Loading dashboard…" />

  const trendData = activity.series

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--navy-900)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-500)' }}>
            Overview of active investigations, network activity and analytical leads.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <div className="font-semibold flex items-center gap-1 justify-end" style={{ color: data.data_status.all_synchronized ? 'var(--success)' : 'var(--warning)' }}>
              <CheckCircle2 size={13} /> {data.data_status.all_synchronized ? 'All sources synchronized' : 'Partial sync'}
            </div>
            <div style={{ color: 'var(--text-500)' }}>DATA STATUS</div>
          </div>
          <div className="text-right">
            <div className="font-semibold" style={{ color: 'var(--navy-900)' }}>Operational</div>
            <div style={{ color: 'var(--text-500)' }}>SYSTEM</div>
          </div>
          <div className="text-right">
            <div className="font-semibold" style={{ color: 'var(--navy-900)' }}>{session?.name}</div>
            <div style={{ color: 'var(--text-500)' }}>{session?.role}</div>
          </div>
        </div>
      </div>

      <InfoBanner />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3 mb-5">
        <KPICard label="Total Cases" value={data.kpis.total_cases} sublabel="All investigations on file" icon={<Briefcase size={15} color="#173F67" />} />
        <KPICard label="Active Cases" value={data.kpis.active_investigations} sublabel="Open, active or under review" icon={<Activity size={15} color="#2563EB" />} />
        <KPICard label="High-Priority Leads" value={data.kpis.high_priority_leads} sublabel="HIGH / CRITICAL severity alerts" icon={<AlertTriangle size={15} color="#DC2626" />} />
        <KPICard label="Total Entities" value={data.kpis.total_entities} sublabel="Across persons, vehicles, orgs, locations" icon={<Users size={15} color="#7C3AED" />} />
        <KPICard label="Network Relationships" value={data.kpis.network_relationships} sublabel="Distinct relationships detected" icon={<Share2 size={15} color="#16A34A" />} />
        <KPICard label="Analytical Alerts" value={data.kpis.analytical_alerts} sublabel="Pattern-based investigative leads" icon={<Bell size={15} color="#F59E0B" />} />
        <KPICard label="Data Sources" value={`${data.kpis.data_sources_connected}/${data.kpis.data_sources}`} sublabel="Connected and validated" icon={<Database size={15} color="#0EA5E9" />} />
        <KPICard label="Unresolved Matches" value={data.kpis.unresolved_entity_matches} sublabel="Entity-resolution candidates" icon={<GitMerge size={15} color="#F59E0B" />} />
      </div>

      <h2 className="text-sm font-bold mb-2 mt-2" style={{ color: 'var(--navy-900)' }}>Investigation Overview</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Section title="Cases by Status">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie
                data={caseDist.by_status} dataKey="count" nameKey="label" innerRadius={45} outerRadius={75}
                onClick={(d: any) => navigate(`/cases?status=${d.label}`)}
                cursor="pointer"
              >
                {caseDist.by_status.map((s: any, i: number) => <Cell key={i} fill={STATUS_COLORS[s.label] ?? PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.percentage}%)`, p.payload.label]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {caseDist.by_status.map((s: any) => (
              <button key={s.label} onClick={() => navigate(`/cases?status=${s.label}`)} className="text-[10px] flex items-center gap-1 hover:underline">
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s.label] ?? '#94A3B8' }} />
                {s.label.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </Section>
        <Section title="Cases by Crime Category">
          <HorizontalBarList data={caseDist.by_category} colorFor={(i) => PIE_COLORS[i % PIE_COLORS.length]}
                              onSelect={(label) => navigate(`/cases?category=${encodeURIComponent(label)}`)} />
        </Section>
        <Section title="Cases by Region">
          <HorizontalBarList data={caseDist.by_region} colorFor={() => '#173F67'}
                              onSelect={(label) => navigate(`/cases?region=${encodeURIComponent(label)}`)} />
        </Section>
      </div>

      <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--navy-900)' }}>Activity Intelligence</h2>
      <div className="grid grid-cols-1 gap-4 mb-6">
        <Section title="Investigation Activity Timeline"
                  right={<span className="text-[10px]" style={{ color: 'var(--text-500)' }}>Click a legend item to toggle a source</span>}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAF4FF" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload
                return (
                  <div className="card p-2.5 text-xs">
                    <div className="font-bold mb-1">{label}</div>
                    <div>Total events: <b>{row.total}</b></div>
                    {SERIES_CONFIG.map((s) => (
                      <div key={s.key} style={{ color: s.color }}>{s.label}: {row[s.key]}</div>
                    ))}
                  </div>
                )
              }} />
              <Legend onClick={(e: any) => toggleSeries(e.dataKey)} wrapperStyle={{ fontSize: 11, cursor: 'pointer' }} />
              {SERIES_CONFIG.map((s) => (
                visibleSeries.includes(s.key) && (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
                )
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Investigation Activity Heatmap" right={<span className="text-[10px]" style={{ color: 'var(--text-500)' }}>Day × Hour, investigation events</span>}>
            <ActivityHeatmap cells={activity.heatmap} />
          </Section>
          <Section title="Analytical Leads Over Time">
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={alertData.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAF4FF" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} onClick={() => navigate('/alerts')} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>
      </div>

      <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--navy-900)' }}>Network Intelligence</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <Section title="Curated Network Overview"
                    right={<button onClick={() => navigate('/network')} className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--navy-800)' }}>Open Full Network Analysis <ArrowRight size={12} /></button>}>
            <p className="text-[11px] mb-2" style={{ color: 'var(--text-500)' }}>
              Showing the {graphData.nodes.length} most analytically relevant entities — not the full network. Click a node to inspect it.
            </p>
            <NetworkGraph data={graphData} height={340} layout="concentric" onNodeClick={(id) => navigate(`/network/${id}`)} />
          </Section>
        </div>
        <Section title="Network Metrics">
          <div className="flex flex-col divide-y" style={{ ['--tw-divide-opacity' as any]: 1 }}>
            {[
              { label: 'Nodes', value: data.network_metrics.node_count },
              { label: 'Relationships', value: data.network_metrics.relationship_count },
              { label: 'Communities', value: data.network_metrics.communities },
              { label: 'Key Connectors', value: data.network_metrics.key_connectors },
              { label: 'Average Degree', value: data.network_metrics.average_degree },
              { label: 'Network Density', value: data.network_metrics.network_density },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-500)' }}>{m.label}</span>
                <span className="font-bold" style={{ color: 'var(--navy-900)' }}>{m.value}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--navy-900)' }}>Priority Analytical Leads</h2>
      <div className="card p-0 overflow-hidden mb-6">
        {alertData.latest_alerts.map((a: any) => (
          <button key={a.alert_id} onClick={() => navigate('/alerts')}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 border-b hover:bg-blue-50 last:border-0"
                  style={{ borderColor: 'var(--border)' }}>
            <StatusBadge value={a.severity} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--navy-900)' }}>{a.alert_type.replace(/_/g, ' ')}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-500)' }}>{a.person} → {a.related_person} · {a.case_id}</div>
            </div>
            <div className="text-xs text-right shrink-0" style={{ color: 'var(--text-500)' }}>
              <div>Confidence {Math.round(Number(a.confidence) * 100)}%</div>
              <div>{new Date(a.timestamp).toLocaleDateString()}</div>
            </div>
            <StatusBadge value={a.status} />
          </button>
        ))}
      </div>

      <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--navy-900)' }}>Cross-Source Intelligence</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <Section title="Source Distribution" right={<span className="text-[10px]" style={{ color: 'var(--text-500)' }}>Where the evidence comes from</span>}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={correlation.sources} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAF4FF" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {correlation.sources.map((s: any, i: number) => <Cell key={i} fill={SOURCE_COLORS[s.source] ?? PIE_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>
        <Section title="Data Freshness">
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2" style={{ color: 'var(--text-700)' }}>
              <Clock size={13} /> Last processed: {data.data_status.last_loaded ? new Date(data.data_status.last_loaded).toLocaleString() : '—'}
            </div>
            {correlation.sources.map((s: any) => (
              <div key={s.source} className="flex items-center justify-between">
                <span style={{ color: 'var(--text-500)' }}>{s.source}</span>
                <span className="font-semibold" style={{ color: 'var(--navy-900)' }}>{s.count} records</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Quick Investigation Actions">
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => navigate('/entities')}><Search size={14} /> Search Entity</button>
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => navigate('/network')}><Share2 size={14} /> Analyze Network</button>
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => navigate('/cases')}><Briefcase size={14} /> Open Case</button>
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => navigate('/alerts')}><Bell size={14} /> Review Alerts</button>
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => navigate('/data-sources')}><Upload size={14} /> Upload Data</button>
          <button className="btn-primary flex items-center gap-1.5" onClick={() => navigate('/reports')}><FileText size={14} /> Generate Report</button>
        </div>
      </Section>
    </div>
  )
}
