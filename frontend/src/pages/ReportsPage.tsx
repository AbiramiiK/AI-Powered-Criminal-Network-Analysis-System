import { useEffect, useState } from 'react'
import { Download, Printer, FileText } from 'lucide-react'
import { reportsApi, casesApi, entitiesApi } from '../services/api'
import { PageHeader, Section, SyntheticBanner, LoadingState } from '../components/Common'
import { StatusBadge } from '../components/Badge'

export function ReportsPage() {
  const [cases, setCases] = useState<any[]>([])
  const [persons, setPersons] = useState<any[]>([])
  const [caseId, setCaseId] = useState('')
  const [personId, setPersonId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    casesApi.list().then((d) => setCases(d.cases))
    entitiesApi.list('person').then((d) => setPersons(d.persons))
  }, [])

  async function generate() {
    setLoading(true)
    setReport(null)
    try {
      const r = await reportsApi.generate({
        case_id: caseId || undefined,
        person_id: personId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      setReport(r)
    } finally {
      setLoading(false)
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `investigation_report_${caseId || personId || 'report'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader title="Investigation Report" description="Generate a structured, explainable investigation report." />
      <SyntheticBanner />

      <div className="card p-4 mb-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-700)' }}>Case</label>
          <select className="input text-sm" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            <option value="">None</option>
            {cases.map((c) => <option key={c.case_id} value={c.case_id}>{c.case_id} — {c.case_title}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-700)' }}>Person</label>
          <select className="input text-sm" value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">None</option>
            {persons.map((p) => <option key={p.person_id} value={p.person_id}>{p.full_name} ({p.person_id})</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-700)' }}>Start Date</label>
          <input type="date" className="input text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-700)' }}>End Date</label>
          <input type="date" className="input text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button className="btn-primary flex items-center gap-1.5" onClick={generate} disabled={loading || (!caseId && !personId)}>
          <FileText size={14} /> {loading ? 'Generating…' : 'Generate Report'}
        </button>
      </div>

      {!caseId && !personId && <p className="text-xs" style={{ color: 'var(--text-500)' }}>Select a case or a person to generate a report.</p>}
      {loading && <LoadingState label="Generating report…" />}

      {report && (
        <div id="report-content" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: 'var(--navy-900)' }}>Investigation Report</h2>
            <div className="flex gap-2 print:hidden">
              <button className="btn-secondary flex items-center gap-1.5" onClick={() => window.print()}><Printer size={14} /> Print</button>
              <button className="btn-secondary flex items-center gap-1.5" onClick={exportJson}><Download size={14} /> Export JSON</button>
            </div>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-500)' }}>Generated {new Date(report.generated_at).toLocaleString()}</p>

          {report.case_overview && (
            <Section title="1. Case Overview">
              <div className="text-sm"><b>{report.case_overview.case_title}</b> ({report.case_overview.case_id})</div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-700)' }}>{report.case_overview.description}</p>
            </Section>
          )}

          <Section title="2. Key Entities">
            <table className="data-table">
              <thead><tr><th>Person</th><th>Network Role</th><th>Investigative Priority</th></tr></thead>
              <tbody>
                {report.key_entities.map((e: any) => (
                  <tr key={e.person_id}><td>{e.name} ({e.person_id})</td><td>{e.network_role}</td><td>{e.investigative_priority_score}/100</td></tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="3-5. Network Summary & Important Relationships">
            <div className="flex flex-col gap-2">
              {report.important_relationships.map((r: any, i: number) => (
                <div key={i} className="text-sm p-2 rounded-lg" style={{ background: 'var(--blue-50)' }}>{r.explanation}</div>
              ))}
              {report.important_relationships.length === 0 && <p className="text-xs" style={{ color: 'var(--text-500)' }}>No high-confidence relationships found for this scope.</p>}
            </div>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="6. Communication Patterns">
              <p className="text-sm">{report.communication_patterns.total_records} records in scope.</p>
            </Section>
            <Section title="7. Financial Patterns">
              <p className="text-sm">{report.financial_patterns.total_records} transactions, total INR {Math.round(report.financial_patterns.total_volume).toLocaleString()}.</p>
            </Section>
            <Section title="8. Location Patterns">
              <p className="text-sm">{report.location_patterns.total_records} location observations.</p>
            </Section>
            <Section title="9. Vehicle Associations">
              <p className="text-sm">{report.vehicle_associations.owned.length} owned, {report.vehicle_associations.associated.length} associated vehicles.</p>
            </Section>
          </div>

          <Section title="10. Intelligence Findings">
            <div className="flex flex-col gap-2">
              {report.intelligence_findings.map((i: any) => (
                <div key={i.intelligence_id} className="text-sm p-2 rounded-lg" style={{ background: 'var(--blue-50)' }}>{i.information_text}</div>
              ))}
            </div>
          </Section>

          <Section title="11. Evidence Summary">
            <p className="text-sm">{report.evidence_summary.total_records} records. Status breakdown: {Object.entries(report.evidence_summary.by_status).map(([k, v]: any) => `${k}: ${v}`).join(', ')}</p>
          </Section>

          <Section title="12. Analytical Alerts">
            <div className="flex flex-col gap-1.5">
              {report.analytical_alerts.map((a: any) => (
                <div key={a.alert_id} className="text-xs flex items-center gap-2">
                  <StatusBadge value={a.severity} /> {a.explanation}
                </div>
              ))}
            </div>
          </Section>

          <Section title="13. Timeline">
            <ol className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {report.timeline.map((t: any, i: number) => (
                <li key={i} className="text-xs flex gap-3">
                  <span className="w-36 shrink-0" style={{ color: 'var(--text-500)' }}>{t.timestamp}</span>
                  <span>{t.description}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Recommended Investigative Actions">
            <ul className="list-disc pl-5 flex flex-col gap-1.5 text-sm">
              {report.recommended_investigative_actions.map((r: string, i: number) => <li key={i}>{r}</li>)}
            </ul>
          </Section>

          <p className="text-xs italic p-3 rounded-lg" style={{ background: 'var(--warning-bg)', color: '#92640a' }}>{report.disclaimer}</p>
        </div>
      )}
    </div>
  )
}
