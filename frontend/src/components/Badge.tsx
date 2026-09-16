const TONES: Record<string, { bg: string; color: string }> = {
  success: { bg: 'var(--success-bg)', color: 'var(--success)' },
  warning: { bg: 'var(--warning-bg)', color: '#92640a' },
  danger: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
  info: { bg: 'var(--info-bg)', color: 'var(--info)' },
  neutral: { bg: '#EEF2F7', color: 'var(--text-500)' },
}

const SEVERITY_TONE: Record<string, string> = {
  LOW: 'neutral',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
  NEW: 'info',
  UNDER_REVIEW: 'warning',
  CONFIRMED_PATTERN: 'danger',
  DISMISSED: 'neutral',
  OPEN: 'info',
  ACTIVE_ANALYSIS: 'warning',
  UNDER_REVIEW_CASE: 'warning',
  CLOSED: 'neutral',
  VERIFIED: 'success',
  UNVERIFIED: 'neutral',
  PARTIALLY_VERIFIED: 'warning',
}

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  const t = TONES[tone] ?? TONES.neutral
  return (
    <span className="badge" style={{ background: t.bg, color: t.color }}>
      {children}
    </span>
  )
}

export function StatusBadge({ value }: { value: string }) {
  const tone = (SEVERITY_TONE[value] as keyof typeof TONES) ?? 'neutral'
  return <Badge tone={tone}>{value?.replace(/_/g, ' ')}</Badge>
}
