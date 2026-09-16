import type { ReactNode } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'

export function PageHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--navy-900)' }}>{title}</h1>
        {description && <p className="text-sm mt-1" style={{ color: 'var(--text-500)' }}>{description}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}

export function KPICard({ label, value, sublabel, icon }: { label: string; value: string | number; sublabel?: string; icon?: ReactNode }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-500)' }}>{label}</span>
        {icon}
      </div>
      <span className="text-2xl font-bold" style={{ color: 'var(--navy-900)' }}>{value}</span>
      {sublabel && <span className="text-xs" style={{ color: 'var(--text-500)' }}>{sublabel}</span>}
    </div>
  )
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm py-10 justify-center" style={{ color: 'var(--text-500)' }}>
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-sm py-10 justify-center" style={{ color: 'var(--text-500)' }}>
      {label}
    </div>
  )
}

export function ErrorState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm py-10 justify-center" style={{ color: 'var(--danger)' }}>
      <ShieldAlert size={16} /> {label}
    </div>
  )
}

export function SyntheticBanner() {
  return (
    <div
      className="text-xs font-semibold px-3 py-2 rounded-lg mb-4 flex items-center gap-2"
      style={{ background: 'var(--warning-bg)', color: '#92640a', border: '1px solid #F3D9A0' }}
    >
      SYNTHETIC DEMONSTRATION DATA — this prototype uses fictional data only. No real
      criminal database or real police intelligence is involved.
    </div>
  )
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: 'var(--navy-900)' }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? 'var(--danger)' : pct >= 45 ? 'var(--warning)' : 'var(--text-500)'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
    </div>
  )
}
