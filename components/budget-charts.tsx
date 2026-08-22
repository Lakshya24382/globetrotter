'use client'

import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts'

const PALETTE = ['#1f7775', '#f2c9b8', '#b95145', '#e8b64c', '#6b8f9c', '#8f6b9c', '#5c8f5c', '#c97b4a']

function currency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid #e3e9e5', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ color: entry.color ?? entry.fill }}>
          {entry.name}: <strong>{currency(entry.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export function CategoryPieChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return <p className="muted">No costed activities added yet.</p>
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function CityBarChart({ data }: { data: { city: string; total: number }[] }) {
  if (data.length === 0) return <p className="muted">No costed activities added yet.</p>
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e3e9e5" />
        <XAxis type="number" tickFormatter={currency} tick={{ fontSize: 11, fill: '#73807d' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="city" width={90} tick={{ fontSize: 12, fill: '#1e2a2a' }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f2f7f3' }} />
        <Bar dataKey="total" name="Spend" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DailySpendChart({ data, budgetAmount }: { data: { date: string; total: number }[]; budgetAmount: number | null }) {
  if (data.length === 0) return <p className="muted">No costed activities added yet.</p>

  let running = 0
  const cumulative = data.map((row) => {
    running += row.total
    return { date: new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), spend: row.total, cumulative: running }
  })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={cumulative} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f7775" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#1f7775" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e9e5" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#73807d' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={currency} tick={{ fontSize: 11, fill: '#73807d' }} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="cumulative" name="Cumulative spend" stroke="#1f7775" strokeWidth={2} fill="url(#spendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
