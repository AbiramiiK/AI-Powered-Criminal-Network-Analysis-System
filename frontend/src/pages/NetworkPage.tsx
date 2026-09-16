import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from 'recharts'
import { Search, X, ChevronRight, Layers, RotateCcw, Eye, ExternalLink } from 'lucide-react'
import { networkApi, entitiesApi, dashboardApi } from '../services/api'
import { LoadingState, EmptyState, SyntheticBanner } from '../components/Common'
import { StatusBadge } from '../components/Badge'
import { NetworkGraph, GRAPH_LEGEND, RELATION_LEGEND } from '../graph/NetworkGraph'
import type { GraphData } from '../types'

const NODE_TYPES = ['PERSON', 'PHONE', 'VEHICLE', 'LOCATION', 'ORGANIZATION', 'CASE']
const RELATION_TYPES = ['CALLED', 'TRANSFERRED_MONEY', 'USED_VEHICLE', 'OBSERVED_AT', 'MEMBER_OF', 'MENTIONED_IN', 'LINKED_TO', 'ASSOCIATED_WITH']
const ANALYTICAL_FILTERS = [
  { key: 'key_connectors', label: 'Key connectors' },
  { key: 'high_centrality', label: 'High centrality' },
  { key: 'cross_case', label: 'Cross-case' },
  { key: 'suspicious_patterns', label: 'Suspicious patterns' },
  { key: 'multi_source', label: 'Multi-source matches' },
]
const TABS = ['NETWORK', 'COMMUNITIES', 'CENTRALITY', 'RELATIONSHIPS', 'TIMELINE'] as const

export function NetworkPage() {
  const { personId } = useParams()
  const navigate = useNavigate()

  const [tab, setTab] = useState<(typeof TABS)[number]>('NETWORK')
  const [entityId, setEntityId] = useState<string | null>(personId ?? null)
  const [communityId, setCommunityId] = useState<number | null>(null)
  const [depth, setDepth] = useState(1)
  const [showAll, setShowAll] = useState(false)

  const [nodeTypes, setNodeTypes] = useState<string[]>(NODE_TYPES)
  const [relationTypes, setRelationTypes] = useState<string[]>(RELATION_TYPES)
  const [analyticalFilters, setAnalyticalFilters] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minDegree, setMinDegree] = useState(0)

  const [graph, setGraph] = useState<GraphData | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)

  const [communities, setCommunities] = useState<any[] | null>(null)

  const filtersApplied = [
    nodeTypes.length < NODE_TYPES.length, relationTypes.length < RELATION_TYPES.length,
    analyticalFilters.length > 0, Boolean(dateFrom || dateTo), minDegree > 0,
  ].filter(Boolean).length

  function clearFilters() {
    setNodeTypes(NODE_TYPES); setRelationTypes(RELATION_TYPES); setAnalyticalFilters([])
    setDateFrom(''); setDateTo(''); setMinDegree(0)
  }

  function resetToOverview() {
    setEntityId(null); setCommunityId(null); setShowAll(false); setDepth(1); setSelected(null)
    navigate('/network')
  }

  useEffect(() => {
    networkApi.communities().then((d) => setCommunities(d.communities))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: Record<string, any> = {
      entity_type: nodeTypes, relationship_type: relationTypes,
      date_from: dateFrom || undefined, date_to: dateTo || undefined,
      min_degree: minDegree, analytical_filter: analyticalFilters,
    }
    let request: Promise<any>
    if (showAll) {
      request = networkApi.filtered({ ...params, show_all: true, max_nodes: 300 })
    } else if (entityId) {
      request = networkApi.filtered({ ...params, entity_id: entityId, depth, max_nodes: depth >= 2 ? 45 : 25 })
    } else if (communityId !== null) {
      request = networkApi.filtered({ ...params, community_id: communityId, max_nodes: 30 })
    } else {
      request = networkApi.overview(18)
    }
    request.then((d) => {
      setGraph({ nodes: d.nodes, edges: d.edges })
      setMetadata(d.metadata ?? { node_count: d.nodes.length, edge_count: d.edges.length, communities: d.communities?.length })
    }).finally(() => setLoading(false))
  }, [entityId, communityId, showAll, depth, nodeTypes, relationTypes, analyticalFilters, dateFrom, dateTo, minDegree])

  useEffect(() => {
    if (searchQuery.trim().length < 1) { setSearchResults([]); return }
    const t = setTimeout(() => {
      entitiesApi.search(searchQuery).then((d) => setSearchResults(d.results ?? []))
    }, 200)
    return () => clearTimeout(t)
  }, [searchQuery])

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  async function handleNodeClick(id: string, _type: string) {
    const detail = await networkApi.entityDetail(id)
    setSelected(detail)
  }

  function selectSearchResult(r: any) {
    setShowAll(false); setCommunityId(null); setDepth(1)
    setEntityId(r.id)
    setSearchQuery(''); setSearchResults([])
    handleNodeClick(r.id, r.category)
  }

  const breadcrumbs = useMemo(() => {
    const crumbs = [{ label: 'Overview', onClick: resetToOverview }]
    if (communityId !== null) crumbs.push({ label: `Community ${communityId + 1}`, onClick: () => {} })
    if (entityId) crumbs.push({ label: selected?.label ?? entityId, onClick: () => {} })
    if (showAll) crumbs.push({ label: 'All Relationships', onClick: () => {} })
    return crumbs
  }, [communityId, entityId, showAll, selected])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--navy-900)' }}>Network Analysis</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-500)' }}>
            Explore relationships across people, communications, transactions, vehicles, locations and organizations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(entityId || communityId !== null || showAll) && (
            <button className="btn-secondary text-xs flex items-center gap-1" onClick={resetToOverview}><RotateCcw size={12} /> Reset</button>
          )}
          <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => setShowAll(true)}><Eye size={12} /> Show All Relationships</button>
        </div>
      </div>
      <SyntheticBanner />

      <div className="flex items-center gap-1 text-xs mb-3" style={{ color: 'var(--text-500)' }}>
        {breadcrumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={11} />}
            <button onClick={c.onClick} className={i === breadcrumbs.length - 1 ? 'font-semibold' : 'hover:underline'} style={i === breadcrumbs.length - 1 ? { color: 'var(--navy-900)' } : {}}>{c.label}</button>
          </span>
        ))}
      </div>

      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-3 py-2 text-xs font-semibold border-b-2"
                  style={{ borderColor: tab === t ? 'var(--navy-800)' : 'transparent', color: tab === t ? 'var(--navy-900)' : 'var(--text-500)' }}>
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {tab === 'NETWORK' && (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_300px] gap-4">
          <div className="card p-3 flex flex-col gap-4 h-fit">
            <div className="input flex items-center gap-2">
              <Search size={13} style={{ color: 'var(--text-500)' }} />
              <input className="flex-1 outline-none text-xs" placeholder="Search person, alias, vehicle…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            {searchResults.length > 0 && (
              <div className="flex flex-col gap-1 -mt-2 max-h-40 overflow-y-auto">
                {searchResults.slice(0, 6).map((r) => (
                  <button key={`${r.category}-${r.id}`} onClick={() => selectSearchResult(r)} className="text-left text-xs px-2 py-1.5 rounded hover:bg-blue-50">
                    <span className="font-semibold">{r.label}</span> <span style={{ color: 'var(--text-500)' }}>· {r.category}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold" style={{ color: 'var(--navy-900)' }}>Filters {filtersApplied > 0 && <span className="ml-1 badge" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}>{filtersApplied}</span>}</p>
              {filtersApplied > 0 && <button onClick={clearFilters} className="text-[10px] font-semibold" style={{ color: 'var(--navy-800)' }}>Clear all</button>}
            </div>

            <div>
              <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-700)' }}>ENTITY TYPE</p>
              <div className="flex flex-col gap-1">
                {NODE_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-700)' }}>
                    <input type="checkbox" checked={nodeTypes.includes(t)} onChange={() => toggle(nodeTypes, setNodeTypes, t)} /> {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-700)' }}>RELATIONSHIP</p>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {RELATION_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-700)' }}>
                    <input type="checkbox" checked={relationTypes.includes(t)} onChange={() => toggle(relationTypes, setRelationTypes, t)} /> {t.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-700)' }}>ANALYTICAL</p>
              <div className="flex flex-col gap-1">
                {ANALYTICAL_FILTERS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-700)' }}>
                    <input type="checkbox" checked={analyticalFilters.includes(f.key)} onChange={() => toggle(analyticalFilters, setAnalyticalFilters, f.key)} /> {f.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-700)' }}>TIME</p>
              <div className="flex flex-col gap-1.5">
                <input type="date" className="input text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <input type="date" className="input text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-700)' }}>MIN. CONNECTIONS: {minDegree}</p>
              <input type="range" min={0} max={15} value={minDegree} onChange={(e) => setMinDegree(Number(e.target.value))} className="w-full" />
            </div>
            {entityId && (
              <div>
                <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-700)' }}>EXPANSION</p>
                <button className="btn-secondary text-xs w-full flex items-center justify-center gap-1" onClick={() => setDepth((d) => Math.min(2, d + 1))} disabled={depth >= 2}>
                  <Layers size={12} /> {depth >= 2 ? 'Second-degree shown' : 'Expand Network (2nd degree)'}
                </button>
              </div>
            )}
            <div>
              <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-700)' }}>LEGEND</p>
              <div className="flex flex-col gap-1">
                {GRAPH_LEGEND.map((l) => (
                  <div key={l.type} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-700)' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} /> {l.label}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1 mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                {RELATION_LEGEND.slice(0, 5).map((l) => (
                  <div key={l.relation} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-700)' }}>
                    <span className="w-3 h-[2px]" style={{ background: l.color }} /> {l.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-2 min-h-[560px]">
            {loading && <LoadingState label="Building network view…" />}
            {!loading && graph && graph.nodes.length === 0 && (
              <EmptyState label="No relationships match the current filters." />
            )}
            {!loading && graph && graph.nodes.length > 0 && (
              <>
                <div className="text-xs px-2 py-1 flex items-center justify-between" style={{ color: 'var(--text-500)' }}>
                  <span>{metadata?.node_count ?? graph.nodes.length} nodes · {metadata?.edge_count ?? graph.edges.length} relationships</span>
                  {showAll && <span className="font-semibold" style={{ color: 'var(--warning)' }}>Full relationship view — use filters to narrow</span>}
                </div>
                <NetworkGraph
                  data={graph}
                  height={540}
                  onNodeClick={handleNodeClick}
                  layout="concentric"
                  rootId={entityId ?? undefined}
                  highlightId={entityId}
                />
              </>
            )}
          </div>

          <div className="card p-4 h-fit">
            {!selected && <p className="text-xs" style={{ color: 'var(--text-500)' }}>Click a node to view entity details, network metrics, and supporting sources.</p>}
            {selected && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="badge" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}>{selected.type}</span>
                  <button onClick={() => setSelected(null)}><X size={14} style={{ color: 'var(--text-500)' }} /></button>
                </div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--navy-900)' }}>{selected.full_name ?? selected.label}</h3>
                <p className="text-xs mb-2" style={{ color: 'var(--text-500)' }}>{selected.id}</p>

                {selected.aliases?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[11px] font-bold" style={{ color: 'var(--text-700)' }}>Aliases</p>
                    <p className="text-xs" style={{ color: 'var(--text-500)' }}>{[...new Set(selected.aliases)].join(', ')}</p>
                  </div>
                )}

                {selected.analytical_tag_labels?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selected.analytical_tag_labels.map((t: string) => (
                      <span key={t} className="badge" style={{ background: 'var(--warning-bg)', color: '#92640a' }}>{t}</span>
                    ))}
                  </div>
                )}

                {selected.type === 'PERSON' && (
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div><div style={{ color: 'var(--text-500)' }}>Degree</div><div className="font-bold">{selected.degree_centrality}</div></div>
                    <div><div style={{ color: 'var(--text-500)' }}>Betweenness</div><div className="font-bold">{selected.betweenness_centrality}</div></div>
                    <div><div style={{ color: 'var(--text-500)' }}>PageRank</div><div className="font-bold">{selected.pagerank}</div></div>
                    <div><div style={{ color: 'var(--text-500)' }}>Closeness</div><div className="font-bold">{selected.closeness_centrality}</div></div>
                  </div>
                )}

                {selected.connected_cases?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[11px] font-bold" style={{ color: 'var(--text-700)' }}>Connected Cases</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selected.connected_cases.map((c: string) => (
                        <button key={c} onClick={() => navigate(`/cases/${c}`)} className="badge" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}>{c}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--text-700)' }}>Relationships ({selected.direct_connections})</p>
                  <div className="flex flex-col gap-0.5 text-xs">
                    {Object.entries(selected.relationship_breakdown ?? {}).map(([type, count]: any) => (
                      <div key={type} className="flex justify-between"><span style={{ color: 'var(--text-500)' }}>{type}</span><span className="font-semibold">{count}</span></div>
                    ))}
                  </div>
                </div>

                {selected.disclaimer && <p className="text-[10px] italic mb-3" style={{ color: 'var(--text-500)' }}>{selected.disclaimer}</p>}

                <div className="flex flex-col gap-1.5">
                  {selected.type === 'PERSON' && (
                    <button className="btn-primary text-xs" onClick={() => navigate(`/entities/person/${selected.id}`)}>View Profile</button>
                  )}
                  <button className="btn-secondary text-xs flex items-center justify-center gap-1" onClick={() => { setEntityId(selected.id); setCommunityId(null); setShowAll(false); setDepth(1) }}>
                    <ExternalLink size={12} /> Expand Connections
                  </button>
                  {selected.type === 'PERSON' && (
                    <>
                      <button className="btn-secondary text-xs" onClick={() => navigate(`/timeline?person_id=${selected.id}`)}>View Timeline</button>
                      <button className="btn-secondary text-xs" onClick={() => navigate(`/entities/person/${selected.id}`)}>View Evidence</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'COMMUNITIES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {communities?.map((c) => (
            <div key={c.community_id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold" style={{ color: 'var(--navy-900)' }}>Community {c.community_id + 1}</h3>
                <StatusBadge value={c.activity_level} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div><div style={{ color: 'var(--text-500)' }}>Entities</div><div className="font-bold">{c.size}</div></div>
                <div><div style={{ color: 'var(--text-500)' }}>Relationships</div><div className="font-bold">{c.relationship_count}</div></div>
              </div>
              <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--text-700)' }}>Key Connectors</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-500)' }}>{c.member_names?.slice(0, 3).join(', ') ?? c.key_connector_names?.join(', ')}</p>
              <button className="btn-primary text-xs w-full"
                      onClick={() => { setTab('NETWORK'); setCommunityId(c.community_id); setEntityId(null); setShowAll(false) }}>
                Focus in Network
              </button>
            </div>
          ))}
          {!communities && <LoadingState label="Detecting communities…" />}
        </div>
      )}

      {tab === 'CENTRALITY' && <CentralityTab onSelect={(id) => { setTab('NETWORK'); setEntityId(id); setCommunityId(null); setShowAll(false) }} />}

      {tab === 'RELATIONSHIPS' && <RelationshipsTab />}

      {tab === 'TIMELINE' && <NetworkTimelineTab />}
    </div>
  )
}

function CentralityTab({ onSelect }: { onSelect: (id: string) => void }) {
  const [data, setData] = useState<any[] | null>(null)
  const [sortKey, setSortKey] = useState('betweenness_centrality')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => { networkApi.centrality(30).then((d) => setData(d.top_connectors)) }, [])

  if (!data) return <LoadingState label="Computing centrality…" />

  const columns = [
    { key: 'name', label: 'Entity' },
    { key: 'degree_centrality', label: 'Degree' },
    { key: 'betweenness_centrality', label: 'Betweenness' },
    { key: 'pagerank', label: 'PageRank' },
    { key: 'closeness_centrality', label: 'Closeness' },
    { key: 'community_id', label: 'Community' },
  ]

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
    return sortDir === 'desc' ? bv - av : av - bv
  })

  function headerClick(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-3 text-xs" style={{ color: 'var(--text-500)' }}>
        "Network Influence Distribution" — click a column to sort. High betweenness indicates an entity frequently
        lies on shortest paths between other network entities; this reflects structure only, not criminal leadership.
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} onClick={() => headerClick(c.key)} className="cursor-pointer select-none">
                {c.label} {sortKey === c.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.person_id} className="cursor-pointer" onClick={() => onSelect(row.person_id)}>
              <td className="font-semibold">{row.name}</td>
              <td>{row.degree_centrality}</td>
              <td>{row.betweenness_centrality}</td>
              <td>{row.pagerank}</td>
              <td>{row.closeness_centrality}</td>
              <td>{row.community_id !== null ? `Community ${row.community_id + 1}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RelationshipsTab() {
  const [data, setData] = useState<any | null>(null)

  useEffect(() => { networkApi.full({}).then(setData) }, [])

  if (!data) return <LoadingState label="Loading relationship statistics…" />

  const byRelation: Record<string, { count: number; pairs: Set<string> }> = {}
  for (const e of data.edges) {
    byRelation[e.relation] ??= { count: 0, pairs: new Set() }
    byRelation[e.relation].count += e.count ?? 1
    byRelation[e.relation].pairs.add(e.source)
    byRelation[e.relation].pairs.add(e.target)
  }

  const rows = Object.entries(byRelation).sort((a, b) => b[1].count - a[1].count)

  return (
    <div className="card p-0 overflow-hidden">
      <table className="data-table">
        <thead><tr><th>Relationship Type</th><th>Total Records</th><th>Entities Involved</th></tr></thead>
        <tbody>
          {rows.map(([relation, stat]) => (
            <tr key={relation}>
              <td className="font-semibold">{relation.replace(/_/g, ' ')}</td>
              <td>{stat.count}</td>
              <td>{stat.pairs.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NetworkTimelineTab() {
  const [data, setData] = useState<any | null>(null)
  useEffect(() => { dashboardApi.activity().then(setData) }, [])

  if (!data) return <LoadingState label="Loading relationship activity…" />

  return (
    <div className="card p-4">
      <p className="text-xs mb-3" style={{ color: 'var(--text-500)' }}>Relationship-forming activity over time, aggregated across communication, financial, location and intelligence sources.</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data.series}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAF4FF" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="total" fill="#173F67" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
