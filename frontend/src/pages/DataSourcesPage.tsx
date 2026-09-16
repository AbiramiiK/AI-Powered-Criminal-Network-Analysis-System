import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, RefreshCw, Upload, ArrowRight } from 'lucide-react'
import { dataApi } from '../services/api'
import { LoadingState, PageHeader, Section, SyntheticBanner } from '../components/Common'

const PIPELINE = ['INGEST', 'VALIDATE', 'NORMALIZE', 'RESOLVE ENTITIES', 'BUILD GRAPH', 'ANALYZE']

export function DataSourcesPage() {
  const [sources, setSources] = useState<any[] | null>(null)
  const [validation, setValidation] = useState<any>(null)
  const [processing, setProcessing] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<any>(null)

  function load() {
    dataApi.sources().then((d) => setSources(d.sources))
    dataApi.validate().then(setValidation)
  }

  useEffect(() => { load() }, [])

  async function processAll() {
    setProcessing(true)
    try {
      await dataApi.processAll()
      load()
    } finally {
      setProcessing(false)
    }
  }

  async function handleUpload(dataset: string, file: File) {
    const result = await dataApi.upload(dataset, file)
    setUploadResult(result)
  }

  if (!sources) return <LoadingState label="Loading data sources…" />

  return (
    <div>
      <PageHeader
        title="Data Sources"
        description="Manage and validate multi-source investigation datasets."
        right={<button className="btn-primary flex items-center gap-1.5" onClick={processAll} disabled={processing}>
          <RefreshCw size={14} className={processing ? 'animate-spin' : ''} /> Process All Sources
        </button>}
      />
      <SyntheticBanner />

      <Section title="Processing Pipeline">
        <div className="flex items-center flex-wrap gap-1 text-xs font-semibold">
          {PIPELINE.map((stage, i) => (
            <div key={stage} className="flex items-center gap-1">
              <span className="px-2.5 py-1 rounded-full" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}>{stage}</span>
              {i < PIPELINE.length - 1 && <ArrowRight size={12} style={{ color: 'var(--text-500)' }} />}
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 my-4">
        {sources.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: 'var(--navy-900)' }}>{s.label}</span>
              {s.connected ? <CheckCircle2 size={16} color="var(--success)" /> : <XCircle size={16} color="var(--danger)" />}
            </div>
            <div className="text-xs flex flex-col gap-1" style={{ color: 'var(--text-500)' }}>
              <div>Records: <b style={{ color: 'var(--text-700)' }}>{s.record_count}</b></div>
              <div>Source: {s.source_file}</div>
              <div>Last processed: {s.last_processed ? new Date(s.last_processed).toLocaleString() : '—'}</div>
            </div>
            <button className="btn-secondary text-xs mt-3 flex items-center gap-1.5" onClick={() => setUploadTarget(s.id)}>
              <Upload size={13} /> Upload replacement CSV
            </button>
            {uploadTarget === s.id && (
              <div className="mt-2">
                <input
                  type="file"
                  accept=".csv"
                  className="text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(s.id, file)
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {uploadResult && (
        <Section title={`Upload Preview: ${uploadResult.filename}`}>
          <p className="text-xs mb-2" style={{ color: uploadResult.valid ? 'var(--success)' : 'var(--danger)' }}>
            {uploadResult.valid ? 'Validated successfully.' : uploadResult.errors.join('; ')}
          </p>
          <p className="text-xs mb-2" style={{ color: 'var(--text-500)' }}>{uploadResult.row_count} rows, columns: {uploadResult.columns.join(', ')}</p>
          <p className="text-xs italic" style={{ color: 'var(--text-500)' }}>{uploadResult.note}</p>
        </Section>
      )}

      {validation && (
        <Section title={`Validation Report — overall ${validation.overall_ok ? 'PASS' : 'FAIL'}`}>
          <table className="data-table">
            <thead><tr><th>Dataset</th><th>Rows</th><th>Duplicate IDs</th><th>Invalid Dates</th><th>Errors</th></tr></thead>
            <tbody>
              {Object.entries(validation.datasets).map(([name, r]: any) => (
                <tr key={name}>
                  <td>{name}</td><td>{r.row_count}</td><td>{r.duplicate_ids}</td><td>{r.invalid_dates}</td>
                  <td style={{ color: r.errors.length ? 'var(--danger)' : 'var(--text-500)' }}>{r.errors.join('; ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs font-semibold mt-4 mb-2" style={{ color: 'var(--navy-900)' }}>Relationship / Foreign-Key Checks</p>
          <table className="data-table">
            <thead><tr><th>Relationship</th><th>Valid</th><th>Invalid</th></tr></thead>
            <tbody>
              {validation.relationships.map((r: any) => (
                <tr key={r.name}><td>{r.name}</td><td>{r.valid_refs}/{r.total_refs}</td>
                  <td style={{ color: r.invalid_refs ? 'var(--danger)' : 'var(--success)' }}>{r.invalid_refs}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  )
}
