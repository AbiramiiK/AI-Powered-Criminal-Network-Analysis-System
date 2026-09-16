import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { entitiesApi } from '../services/api'
import { LoadingState, PageHeader, Section, SyntheticBanner } from '../components/Common'

const TABS = [
  { key: 'persons', label: 'Persons' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'locations', label: 'Locations' },
  { key: 'organizations', label: 'Organizations' },
]

export function EntitiesPage() {
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState('persons')
  const [q, setQ] = useState('')
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    entitiesApi.list().then(setData)
    const type = params.get('type')
    if (type) setTab(type === 'vehicle' ? 'vehicles' : type === 'organization' ? 'organizations' : type === 'location' ? 'locations' : 'persons')
  }, [])

  if (!data) return <LoadingState label="Loading entities…" />

  const ql = q.toLowerCase()
  const persons = data.persons.filter((p: any) => !q || `${p.full_name} ${p.person_id} ${p.primary_alias}`.toLowerCase().includes(ql))
  const vehicles = data.vehicles.filter((v: any) => !q || `${v.vehicle_id} ${v.registration_id} ${v.model_label}`.toLowerCase().includes(ql))
  const locations = data.locations.filter((l: any) => !q || `${l.location_id} ${l.location_name}`.toLowerCase().includes(ql))
  const organizations = data.organizations.filter((o: any) => !q || `${o.organization_id} ${o.organization_name}`.toLowerCase().includes(ql))

  return (
    <div>
      <PageHeader title="Entity Explorer" description="Search across persons, vehicles, locations and organizations." />
      <SyntheticBanner />

      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="px-3 py-2 text-xs font-semibold border-b-2"
            style={{ borderColor: tab === t.key ? 'var(--navy-800)' : 'transparent', color: tab === t.key ? 'var(--navy-900)' : 'var(--text-500)' }}>
            {t.label}
          </button>
        ))}
      </div>

      <input className="input w-full mb-4" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />

      {tab === 'persons' && (
        <Section title={`Persons (${persons.length})`}>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Name</th><th>Alias</th><th>Organization</th><th>Zone</th></tr></thead>
            <tbody>
              {persons.map((p: any) => (
                <tr key={p.person_id} className="cursor-pointer" onClick={() => navigate(`/entities/person/${p.person_id}`)}>
                  <td className="font-mono">{p.person_id}</td><td className="font-semibold">{p.full_name}</td>
                  <td>{p.primary_alias}</td><td>{p.organization}</td><td>{p.address_zone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      {tab === 'vehicles' && (
        <Section title={`Vehicles (${vehicles.length})`}>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Registration</th><th>Type</th><th>Model</th><th>Color</th><th>Owner</th></tr></thead>
            <tbody>
              {vehicles.map((v: any) => (
                <tr key={v.vehicle_id} className="cursor-pointer" onClick={() => navigate(`/entities/person/${v.primary_owner_id}`)}>
                  <td className="font-mono">{v.vehicle_id}</td><td>{v.registration_id}</td><td>{v.vehicle_type}</td>
                  <td>{v.model_label}</td><td>{v.color_description}</td><td>{v.primary_owner_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      {tab === 'locations' && (
        <Section title={`Locations (${locations.length})`}>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Name</th><th>Latitude</th><th>Longitude</th></tr></thead>
            <tbody>
              {locations.map((l: any) => (
                <tr key={l.location_id}><td className="font-mono">{l.location_id}</td><td>{l.location_name}</td><td>{l.latitude}</td><td>{l.longitude}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      {tab === 'organizations' && (
        <Section title={`Organizations (${organizations.length})`}>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Region</th><th>Description</th></tr></thead>
            <tbody>
              {organizations.map((o: any) => (
                <tr key={o.organization_id}><td className="font-mono">{o.organization_id}</td><td>{o.organization_name}</td>
                  <td>{o.organization_type}</td><td>{o.region}</td><td>{o.description}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  )
}
