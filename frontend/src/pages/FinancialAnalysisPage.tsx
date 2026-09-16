import { useEffect, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts'
import { analyticsApi } from '../services/api'
import { KPICard, LoadingState, PageHeader, Section, SyntheticBanner } from '../components/Common'

export function FinancialAnalysisPage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => { analyticsApi.transactions().then(setData) }, [])

  if (!data) return <LoadingState label="Loading financial analytics…" />

  const volumeSeries = Object.entries(data.volume_over_time).map(([month, amount]) => ({ month, amount }))
  const patternSeries = Object.entries(data.by_pattern_type).map(([name, value]) => ({ name, value }))
  const topSenders = Object.entries(data.top_senders).map(([id, amount]) => ({ id, amount }))

  return (
    <div>
      <PageHeader title="Financial Analysis" description="Transaction volume, high-value transfers, chains and circular flows." />
      <SyntheticBanner />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Total Volume" value={`INR ${Math.round(data.total_volume).toLocaleString()}`} />
        <KPICard label="Transactions" value={data.total_transactions} />
        <KPICard label="High-Value Txns" value={data.high_value_transactions} />
        <KPICard label="Median Amount" value={`INR ${Math.round(data.amount_distribution.median).toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Section title="Transaction Volume Over Time">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={volumeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAF4FF" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="amount" stroke="#173F67" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Section>
        <Section title="Pattern Types">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={patternSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAF4FF" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      <Section title="Top Senders by Volume">
        <table className="data-table">
          <thead><tr><th>Person</th><th>Total Sent (INR)</th></tr></thead>
          <tbody>
            {topSenders.map((s) => <tr key={s.id}><td>{s.id}</td><td>{Math.round(Number(s.amount)).toLocaleString()}</td></tr>)}
          </tbody>
        </table>
      </Section>
    </div>
  )
}
