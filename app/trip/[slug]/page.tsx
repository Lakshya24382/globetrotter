'use client'

import { use, useEffect, useState } from 'react'
import { CalendarDays, MapPin, User } from 'lucide-react'

type PublicTrip = {
  id: string
  name: string
  description: string | null
  cover_photo: string | null
  start_date: string
  end_date: string
  owner_name: string
}
type PublicStop = { id: string; start_date: string; end_date: string; order_index: number; city_name: string; city_country: string }
type PublicActivity = { stop_id: string; date: string; start_time: string; cost: string; notes: string | null; activity_name: string; category: string }

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PublicTripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [trip, setTrip] = useState<PublicTrip | null>(null)
  const [stops, setStops] = useState<PublicStop[]>([])
  const [activities, setActivities] = useState<PublicActivity[]>([])
  const [status, setStatus] = useState<'loading' | 'ok' | 'not-found'>('loading')

  useEffect(() => {
    fetch(`/api/trips/public/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then((data) => {
        setTrip(data.trip)
        setStops(data.stops)
        setActivities(data.activities)
        setStatus('ok')
      })
      .catch(() => setStatus('not-found'))
  }, [slug])

  if (status === 'loading') {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <p style={{ color: '#8a8a85' }}>Loading trip…</p>
      </main>
    )
  }

  if (status === 'not-found' || !trip) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>This trip isn't shared</h1>
        <p style={{ color: '#8a8a85' }}>The link may be wrong, or the owner has made this trip private again.</p>
      </main>
    )
  }

  const activitiesByStop = activities.reduce<Record<string, PublicActivity[]>>((acc, activity) => {
    ;(acc[activity.stop_id] ??= []).push(activity)
    return acc
  }, {})

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', color: '#b5764f', fontWeight: 600 }}>
        Shared itinerary
      </p>
      <h1 style={{ fontSize: '2.5rem', margin: '0.25rem 0 0.75rem', fontFamily: 'serif' }}>{trip.name}</h1>
      {trip.description && <p style={{ color: '#5a5a55', marginBottom: '1rem' }}>{trip.description}</p>}
      <div style={{ display: 'flex', gap: '1.5rem', color: '#8a8a85', fontSize: '0.9rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CalendarDays size={16} /> {formatDate(trip.start_date)} — {formatDate(trip.end_date)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <User size={16} /> Planned by {trip.owner_name}
        </span>
      </div>

      {stops.length === 0 && <p style={{ color: '#8a8a85' }}>No stops have been added to this trip yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {stops.map((stop) => (
          <section key={stop.id} style={{ borderLeft: '2px solid #d8d4c8', paddingLeft: '1.25rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.25rem', margin: 0 }}>
              <MapPin size={18} /> {stop.city_name}, {stop.city_country}
            </h2>
            <p style={{ color: '#8a8a85', fontSize: '0.85rem', margin: '0.25rem 0 0.75rem' }}>
              {formatDate(stop.start_date)} — {formatDate(stop.end_date)}
            </p>
            {(activitiesByStop[stop.id] ?? []).length === 0 ? (
              <p style={{ color: '#b5b0a5', fontSize: '0.85rem' }}>No activities added for this stop yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {(activitiesByStop[stop.id] ?? []).map((activity, index) => (
                  <li key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>
                      <strong>{activity.start_time}</strong> — {activity.activity_name}{' '}
                      <span style={{ color: '#b5b0a5' }}>({activity.category})</span>
                    </span>
                    <span style={{ color: '#5a5a55' }}>${Number(activity.cost).toFixed(0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  )
}
