import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { nlpApi } from '../services/api'
import { PageHeader, Section, SyntheticBanner, ConfidenceBar } from '../components/Common'

export function AiAnalysisPage() {
  const [text, setText] = useState('')
  const [samples, setSamples] = useState<string[]>([])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { nlpApi.samples().then((d) => setSamples(d.samples)) }, [])

  async function run() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const r = await nlpApi.extract(text)
      setResult(r)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader title="AI / NLP Investigation" description="Paste or upload a synthetic FIR / intelligence report to extract entities and relationships." />
      <SyntheticBanner />

      <div className="p-3 rounded-lg text-xs font-semibold mb-4" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}>
        Runs in DEMO MODE — deterministic entity matching against the known dataset dictionary. No external LLM API key required.
        The architecture supports plugging in an LLM provider later without changing this UI.
      </div>

      <Section title="Input Text">
        <textarea
          className="input w-full h-32 mb-2"
          placeholder="Paste FIR / intelligence report text…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap gap-2 mb-3">
          {samples.map((s, i) => (
            <button key={i} className="btn-secondary text-xs" onClick={() => setText(s)}>Sample {i + 1}</button>
          ))}
        </div>
        <button className="btn-primary flex items-center gap-1.5" onClick={run} disabled={loading}>
          <Sparkles size={14} /> {loading ? 'Extracting…' : 'Extract Entities'}
        </button>
      </Section>

      {result && (
        <div className="mt-4 flex flex-col gap-4">
          <Section title="Extracted Entities" right={<ConfidenceBar value={result.overall_confidence} />}>
            <div className="flex flex-wrap gap-2">
              {result.entities.map((e: any, i: number) => (
                <button
                  key={i}
                  className="badge"
                  style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}
                  onClick={() => e.type === 'PERSON' && e.resolved_id && navigate(`/entities/person/${e.resolved_id}`)}
                >
                  {e.type} → {e.value} {e.resolved_id ? `(${e.resolved_id})` : ''}
                </button>
              ))}
              {result.entities.length === 0 && <span className="text-xs" style={{ color: 'var(--text-500)' }}>No known entities recognized in this text.</span>}
            </div>
          </Section>

          <Section title="Relationships Extracted">
            <div className="flex flex-col gap-2">
              {result.relationships.map((r: any, i: number) => (
                <div key={i} className="text-sm">
                  <b>{r.source}</b> → <span style={{ color: 'var(--navy-800)' }}>{r.relation}</span> → <b>{r.target}</b>
                  <span className="text-xs ml-2" style={{ color: 'var(--text-500)' }}>confidence {Math.round(r.confidence * 100)}%</span>
                </div>
              ))}
              {result.relationships.length === 0 && <span className="text-xs" style={{ color: 'var(--text-500)' }}>No relationships inferred.</span>}
            </div>
          </Section>

          <p className="text-xs italic" style={{ color: 'var(--text-500)' }}>{result.disclaimer}</p>
        </div>
      )}
    </div>
  )
}
