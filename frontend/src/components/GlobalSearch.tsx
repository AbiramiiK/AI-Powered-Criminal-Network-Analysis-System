import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { entitiesApi } from '../services/api'

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([])
      return
    }
    const timeout = setTimeout(() => {
      entitiesApi.search(query).then((data) => setResults(data.results ?? []))
    }, 200)
    return () => clearTimeout(timeout)
  }, [query])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" style={{ background: 'rgba(11,39,72,0.4)' }} onClick={onClose}>
      <div className="card w-full max-w-xl p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-500)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search persons, aliases, vehicles, locations, organizations, cases…"
            className="flex-1 outline-none text-sm"
          />
          <button onClick={onClose}><X size={16} style={{ color: 'var(--text-500)' }} /></button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 && query.trim().length > 0 && (
            <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-500)' }}>No matches found.</div>
          )}
          {results.map((r) => (
            <button
              key={`${r.category}-${r.id}`}
              onClick={() => { navigate(r.route); onClose() }}
              className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-blue-50 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--navy-900)' }}>{r.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-500)' }}>{r.subtitle}</div>
              </div>
              <span className="badge" style={{ background: 'var(--blue-100)', color: 'var(--navy-800)' }}>{r.category}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
