'use client'

import { useEffect, useState } from 'react'

type Stats = {
  totals: { users: number; trips: number; publicTrips: number }
  topCities: { name: string; country: string; trip_count: number }[]
  topActivities: { name: string; category: string; use_count: number }[]
  recentUsers: { name: string; email: string; created_at: string }[]
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading')

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async (res) => {
        if (res.status === 403 || res.status === 401) throw new Error('forbidden')
        if (!res.ok) throw new Error('error')
        return res.json()
      })
      .then((data) => {
        setStats(data)
        setStatus('ok')
      })
      .catch((err) => setStatus(err.message === 'forbidden' ? 'forbidden' : 'error'))
  }, [])

  if (status === 'loading') return <main style={{ padding: '3rem', color: '#8a8a85' }}>Loading dashboard…</main>
  if (status === 'forbidden')
    return (
      <main style={{ padding: '3rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Admin access required</h1>
        <p style={{ color: '#8a8a85' }}>Your account doesn't have admin privileges.</p>
      </main>
    )
  if (status === 'error' || !stats)
    return <main style={{ padding: '3rem', color: '#8a8a85' }}>Couldn't load admin stats. Try refreshing.</main>

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', color: '#b5764f', fontWeight: 600 }}>
        Admin
      </p>
      <h1 style={{ fontSize: '2.25rem', margin: '0.25rem 0 2rem', fontFamily: 'serif' }}>Platform overview</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
        {[
          { label: 'Total users', value: stats.totals.users },
          { label: 'Total trips', value: stats.totals.trips },
          { label: 'Public trips', value: stats.totals.publicTrips },
        ].map((stat) => (
          <div key={stat.label} style={{ border: '1px solid #e5e1d5', borderRadius: 12, padding: '1.25rem' }}>
            <p style={{ color: '#8a8a85', fontSize: '0.8rem', margin: 0 }}>{stat.label}</p>
            <strong style={{ fontSize: '1.75rem' }}>{stat.value}</strong>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
        <section>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Top cities</h2>
          {stats.topCities.length === 0 && <p style={{ color: '#8a8a85', fontSize: '0.85rem' }}>No stops added yet.</p>}
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.topCities.map((city) => (
              <li key={`${city.name}-${city.country}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>{city.name}, {city.country}</span>
                <strong>{city.trip_count} trips</strong>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Top activities</h2>
          {stats.topActivities.length === 0 && <p style={{ color: '#8a8a85', fontSize: '0.85rem' }}>No activities added yet.</p>}
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.topActivities.map((activity) => (
              <li key={activity.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>{activity.name} <span style={{ color: '#b5b0a5' }}>({activity.category})</span></span>
                <strong>{activity.use_count}×</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Recent signups</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#8a8a85', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '0.4rem 0' }}>Name</th>
              <th>Email</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentUsers.map((user) => (
              <tr key={user.email} style={{ borderTop: '1px solid #eeeae0' }}>
                <td style={{ padding: '0.5rem 0' }}>{user.name}</td>
                <td>{user.email}</td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
