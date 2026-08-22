'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight, Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign,
  Clock, Compass, GripVertical, Grid2X2, Heart, Home, List, MapPin, Menu, MoreHorizontal, Plus,
  Search, Settings, Share2, Sparkles, Ticket, Trash2, Users, X,
} from 'lucide-react'

import { CategoryPieChart, CityBarChart, DailySpendChart } from './budget-charts'

type Page = 'Overview' | 'My trips' | 'Discover' | 'Budget' | 'Settings' | 'Trip details'

type SessionUser = { id: string; name: string; email: string; photo_url: string | null }

type DbCity = {
  id: string
  name: string
  country: string
  region: string | null
  cost_index: number
  popularity: number
  image_url: string | null
}

type DbStop = { id: string; startDate: string; endDate: string; city: { id: string; name: string; country: string } }

type DbTrip = {
  id: string
  owner_id: string
  name: string
  description: string | null
  cover_photo: string | null
  start_date: string
  end_date: string
  is_public: boolean
  share_slug: string | null
  budget_amount: string | null
  total_spent?: string | number
  created_at: string
  updated_at: string
  stops: DbStop[]
}

type TripDetailStop = { id: string; start_date: string; end_date: string; order_index: number; city_name: string; city_country: string; city_id?: string }
type TripDetailActivity = { id: string; stop_id: string; date: string; start_time: string; cost: string; notes: string | null; activity_name: string; category: string }
type TripDetail = { trip: DbTrip; stops: TripDetailStop[]; activities: TripDetailActivity[] }
type Budget = {
  total: number
  budgetAmount: number | null
  remaining: number | null
  percentUsed: number | null
  isOverBudget: boolean
  averagePerDay: number
  tripDays: number
  byCategory: Record<string, number>
  byCity: { city: string; total: number }[]
  byStop: { stopId: string; city: string; country: string; startDate: string; endDate: string; total: number; activityCount: number }[]
  byDay: { date: string; total: number }[]
}
type CatalogActivity = { id: string; name: string; category: string; default_cost: string; duration_min: number; description: string | null }

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=900&q=85'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatRange(start: string, end: string) {
  return `${formatDate(start)} — ${formatDate(end)}`
}
function tripStatus(trip: DbTrip): 'Upcoming' | 'Past' {
  return new Date(trip.end_date) < new Date() ? 'Past' : 'Upcoming'
}
function tripDurationDays(trip: DbTrip) {
  const ms = new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}
function tripPrimaryLocation(trip: DbTrip) {
  if (trip.stops?.length) return `${trip.stops[0].city.name}, ${trip.stops[0].city.country}`
  return trip.name
}
async function safeJson(res: Response) {
  const raw = await res.text()
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return { error: 'Unexpected response from server' } }
}
function firstErrorMessage(result: any, fallback: string) {
  if (typeof result?.error === 'string') return result.error
  const field = Object.values(result?.error?.fieldErrors ?? {}).flat()[0]
  return typeof field === 'string' ? field : fallback
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-mark"><span /></div>
      <span className="font-serif text-[22px] font-semibold tracking-[-0.03em]">GlobeTrotter</span>
    </div>
  )
}

function usePersistedPage(key: string, initial: Page) {
  const [value, setValue] = useState<Page>(initial)
  useEffect(() => { try { const stored = window.localStorage.getItem(key); if (stored) setValue(JSON.parse(stored)) } catch {} }, [key])
  useEffect(() => { try { window.localStorage.setItem(key, JSON.stringify(value)) } catch {} }, [key, value])
  return [value, setValue] as const
}

export default function GlobeTrotterDashboard() {
  const [active, setActive] = usePersistedPage('gt-page', 'Overview')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authError, setAuthError] = useState('')

  const [trips, setTrips] = useState<DbTrip[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [cities, setCities] = useState<DbCity[]>([])
  const [citiesLoading, setCitiesLoading] = useState(true)
  const [favorites, setFavorites] = useState<string[]>([])
  const [query, setQuery] = useState('')

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [tripDetail, setTripDetail] = useState<TripDetail | null>(null)
  const [budget, setBudget] = useState<Budget | null>(null)
  const [budgetError, setBudgetError] = useState('')

  const [isModalOpen, setModalOpen] = useState(false)
  const [isStopModalOpen, setStopModalOpen] = useState(false)
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null)
  const [activityModalStop, setActivityModalStop] = useState<TripDetailStop | null>(null)
  const [activityCatalog, setActivityCatalog] = useState<CatalogActivity[]>([])
  const [pendingActivityCost, setPendingActivityCost] = useState(0)
  const [activityCatalogLoading, setActivityCatalogLoading] = useState(false)
  const [draggedStopId, setDraggedStopId] = useState<string | null>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [calendarOffset, setCalendarOffset] = useState(0)

  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }

  // -- auth bootstrap --------------------------------------------------
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => { setUser(data.user); setAuthenticated(Boolean(data.user)) })
      .catch(() => setAuthenticated(false))
  }, [])

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') || '').trim()
    const password = String(data.get('password') || '')
    const name = String(data.get('name') || '').trim()

    setAuthError('')
    const endpoint = authMode === 'signin' ? '/api/auth/login' : '/api/auth/signup'
    const body = authMode === 'signin' ? { email, password } : { email, password, name }

    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await safeJson(res)
    if (!res.ok) { setAuthError(firstErrorMessage(result, 'Something went wrong')); return }

    setUser(result)
    setAuthenticated(true)
    showNotice(authMode === 'signin' ? 'Welcome back to GlobeTrotter' : 'Your account is ready')
  }

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuthenticated(false)
    setUser(null)
    setProfileMenuOpen(false)
    setActive('Overview')
    showNotice('Signed out')
  }

  // -- trips + cities (real data) ---------------------------------------
  useEffect(() => {
    if (!authenticated) return
    setTripsLoading(true)
    fetch('/api/trips')
      .then((res) => (res.ok ? res.json() : { trips: [] }))
      .then((data) => setTrips(data.trips))
      .catch(() => showNotice('Could not load your trips'))
      .finally(() => setTripsLoading(false))
  }, [authenticated])

  useEffect(() => {
    if (!authenticated) return
    setCitiesLoading(true)
    const timer = setTimeout(() => {
      const url = query ? `/api/cities?q=${encodeURIComponent(query)}` : '/api/cities'
      fetch(url)
        .then((res) => (res.ok ? res.json() : { cities: [] }))
        .then((data) => setCities(data.cities))
        .catch(() => showNotice('Could not load destinations'))
        .finally(() => setCitiesLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [authenticated, query])

  const totalSpent = budget?.total ?? 0

  if (authenticated === null) return <main className="auth-shell"><p className="muted">Loading…</p></main>

  if (!authenticated) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <Logo />
          <p className="eyebrow">Your travel desk</p>
          <h1>{authMode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h1>
          <p className="heading-copy">Plan thoughtful trips, keep the details close, and leave room for discovery.</p>
          <form className="auth-form" onSubmit={handleAuth}>
            {authMode === 'signup' && (
              <label>Full name<input name="name" type="text" autoComplete="name" placeholder="Alex Morgan" required /></label>
            )}
            <label>Email address<input name="email" type="email" autoComplete="email" placeholder="alex@example.com" required /></label>
            <label>Password<input name="password" type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 8 characters, one capital, one number" required /></label>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            <button className="primary-button auth-submit" type="submit">
              {authMode === 'signin' ? 'Sign in' : 'Create account'} <ArrowUpRight size={17} />
            </button>
          </form>
          <button className="auth-switch" type="button" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthError('') }}>
            {authMode === 'signin' ? 'New to GlobeTrotter? Create an account' : 'Already have an account? Sign in'}
          </button>
        </div>
      </main>
    )
  }

  const nav = (page: Page) => { setActive(page); setMobileNav(false); setProfileMenuOpen(false) }

  const addTrip = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') || '').trim()
    const startDate = String(data.get('startDate') || '')
    const endDate = String(data.get('endDate') || '')
    const description = String(data.get('description') || '').trim()
    const budgetAmountRaw = String(data.get('budgetAmount') || '').trim()
    if (!name || !startDate || !endDate) return showNotice('Add a trip name and both dates')

    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        startDate,
        endDate,
        description: description || undefined,
        budgetAmount: budgetAmountRaw ? Number(budgetAmountRaw) : undefined,
      }),
    })
    const result = await safeJson(res)
    if (!res.ok) return showNotice(firstErrorMessage(result, 'Could not create trip'))

    setTrips((current) => [{ ...result.trip, stops: [] }, ...current])
    setModalOpen(false)
    nav('My trips')
    showNotice(`${name} added to your trips`)
  }

  const openTripDetails = async (tripId: string) => {
    setActive('Trip details')
    setSelectedTripId(tripId)
    setTripDetail(null)
    setBudget(null)
    setBudgetError('')
    const [detailRes, budgetRes] = await Promise.all([
      fetch(`/api/trips/${tripId}`),
      fetch(`/api/trips/${tripId}/budget`),
    ])
    if (detailRes.ok) setTripDetail(await detailRes.json())
    else showNotice('Could not load that trip')
    if (budgetRes.ok) setBudget(await budgetRes.json())
    else setBudgetError(firstErrorMessage(await safeJson(budgetRes), 'Could not load budget'))
  }

  const addStop = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTripId) return
    const data = new FormData(event.currentTarget)
    const cityId = String(data.get('cityId') || '')
    const startDate = String(data.get('startDate') || '')
    const endDate = String(data.get('endDate') || '')
    if (!cityId || !startDate || !endDate) return showNotice('Pick a city and both dates')

    const res = await fetch(`/api/trips/${selectedTripId}/stops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId, startDate, endDate }),
    })
    const result = await safeJson(res)
    if (!res.ok) return showNotice(firstErrorMessage(result, 'Could not add stop'))

    setStopModalOpen(false)
    showNotice('Stop added to your itinerary')
    openTripDetails(selectedTripId)
  }

  const removeStop = async (stopId: string) => {
    if (!selectedTripId) return
    const res = await fetch(`/api/trips/${selectedTripId}/stops/${stopId}`, { method: 'DELETE' })
    if (!res.ok) return showNotice('Could not remove that stop')
    setTripDetail((current) =>
      current
        ? { ...current, stops: current.stops.filter((s) => s.id !== stopId), activities: current.activities.filter((a) => a.stop_id !== stopId) }
        : current
    )
    showNotice('Stop removed')
  }

  const reorderStops = async (nextStops: TripDetailStop[]) => {
    if (!selectedTripId) return
    setTripDetail((current) => (current ? { ...current, stops: nextStops } : current))
    const res = await fetch(`/api/trips/${selectedTripId}/stops/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: nextStops.map((s) => s.id) }),
    })
    if (!res.ok) { showNotice('Could not save the new order'); openTripDetails(selectedTripId) }
  }

  const handleStopDrop = (targetStopId: string) => {
    if (!draggedStopId || !tripDetail || draggedStopId === targetStopId) { setDraggedStopId(null); return }
    const stops = [...tripDetail.stops]
    const fromIndex = stops.findIndex((s) => s.id === draggedStopId)
    const toIndex = stops.findIndex((s) => s.id === targetStopId)
    if (fromIndex === -1 || toIndex === -1) { setDraggedStopId(null); return }
    const [moved] = stops.splice(fromIndex, 1)
    stops.splice(toIndex, 0, moved)
    setDraggedStopId(null)
    reorderStops(stops)
  }

  const openActivityModal = async (stop: TripDetailStop) => {
    setActivityModalStop(stop)
    setPendingActivityCost(0)
    setActivityCatalogLoading(true)
    try {
      const res = await fetch(`/api/activities?cityId=${stop.city_id}`)
      const data = res.ok ? await res.json() : { activities: [] }
      setActivityCatalog(data.activities ?? [])
    } catch {
      setActivityCatalog([])
    } finally {
      setActivityCatalogLoading(false)
    }
  }

  const addActivityToStop = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTripId || !activityModalStop) return
    const data = new FormData(event.currentTarget)
    const activityId = String(data.get('activityId') || '')
    const date = String(data.get('date') || '')
    const startTime = String(data.get('startTime') || '')
    const cost = String(data.get('cost') || '0')
    const notes = String(data.get('notes') || '')
    if (!activityId || !date || !startTime) return showNotice('Pick an activity, date, and time')

    const res = await fetch(`/api/trips/${selectedTripId}/stops/${activityModalStop.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId, date, startTime, cost, notes: notes || undefined }),
    })
    const result = await safeJson(res)
    if (!res.ok) return showNotice(firstErrorMessage(result, 'Could not add activity'))

    setTripDetail((current) => (current ? { ...current, activities: [...current.activities, result.activity] } : current))
    if (result.budgetSnapshot) {
      setBudget((current) => {
        const snap = result.budgetSnapshot
        const percentUsed = snap.budgetAmount ? Math.round((snap.total / snap.budgetAmount) * 100) : null
        return current
          ? { ...current, total: snap.total, budgetAmount: snap.budgetAmount, remaining: snap.remaining, isOverBudget: snap.isOverBudget, percentUsed }
          : current
      })
    }
    setActivityModalStop(null)
    setPendingActivityCost(0)
    setExpandedStopId(activityModalStop.id)
    showNotice('Activity added')
  }

  const removeActivity = async (stopId: string, activityRowId: string) => {
    if (!selectedTripId) return
    const res = await fetch(`/api/trips/${selectedTripId}/stops/${stopId}/activities/${activityRowId}`, { method: 'DELETE' })
    if (!res.ok) return showNotice('Could not remove that activity')
    setTripDetail((current) => (current ? { ...current, activities: current.activities.filter((a) => a.id !== activityRowId) } : current))
    showNotice('Activity removed')
    fetch(`/api/trips/${selectedTripId}/budget`).then((r) => (r.ok ? r.json() : null)).then((b) => b && setBudget(b))
  }

  const shareTrip = async (tripId: string) => {
    const res = await fetch(`/api/trips/${tripId}/share`, { method: 'POST' })
    if (!res.ok) return showNotice('Could not create a share link')
    const result = await res.json()
    const url = `${window.location.origin}/trip/${result.share_slug}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setTripDetail((current) => (current ? { ...current, trip: { ...current.trip, is_public: true, share_slug: result.share_slug } } : current))
    showNotice('Public link copied to clipboard')
  }

  const toggleFavorite = (cityKey: string) =>
    setFavorites((current) => (current.includes(cityKey) ? current.filter((item) => item !== cityKey) : [...current, cityKey]))

  return (
    <main className="dashboard-shell">
      {notice && <div className="dashboard-toast" role="status">{notice}</div>}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={19} /></button>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {(['Overview', 'My trips', 'Discover', 'Budget'] as Page[]).map((label, index) => {
            const Icon = [Home, CalendarDays, Compass, CircleDollarSign][index]
            return (
              <button key={label} className={`nav-item ${active === label ? 'nav-item-active' : ''}`} onClick={() => nav(label)}>
                <Icon size={18} /><span>{label}</span>
                {label === 'My trips' && <span className="nav-count">{trips.length}</span>}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <button className={`nav-item ${active === 'Settings' ? 'nav-item-active' : ''}`} onClick={() => nav('Settings')}>
            <Settings size={18} /><span>Settings</span>
          </button>
          <div className="profile-menu-wrap">
            <div className="user-chip">
              <div className="avatar">{(user?.name ?? '?').slice(0, 2).toUpperCase()}</div>
              <div><strong>{user?.name}</strong><small>{user?.email}</small></div>
              <button className="profile-menu-trigger" aria-label="Open profile menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}>
                <MoreHorizontal size={17} />
              </button>
            </div>
            {profileMenuOpen && (
              <div className="profile-menu" role="menu">
                <button role="menuitem" onClick={() => { nav('Settings') }}>Account settings</button>
                <button role="menuitem" onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </aside>
      {mobileNav && <button className="nav-overlay" aria-label="Close menu" onClick={() => setMobileNav(false)} />}

      <section className="content-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
          <button className="breadcrumb" onClick={() => nav('Overview')}>
            <span>Good morning, {user?.name?.split(' ')[0]}</span><span className="breadcrumb-dot">/</span><span className="muted">{active}</span>
          </button>
          <div className="topbar-actions">
            <div className="search-box">
              <Search size={17} />
              <input aria-label="Search destinations" placeholder="Search destinations" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => showNotice('You are all caught up')}><Bell size={19} /><i /></button>
            <button className="top-avatar" aria-label="Open settings" onClick={() => nav('Settings')}>{(user?.name ?? '?').slice(0, 2).toUpperCase()}</button>
          </div>
        </header>

        {active === 'Overview' && (
          <Overview
            trips={trips} tripsLoading={tripsLoading} destinations={cities} favorites={favorites} toggleFavorite={toggleFavorite}
            view={view} setView={setView} calendarOffset={calendarOffset} setCalendarOffset={setCalendarOffset}
            onNewTrip={() => setModalOpen(true)} onNavigate={nav} onNotice={showNotice} onOpenTrip={openTripDetails}
          />
        )}
        {active === 'My trips' && (
          <TripsPage trips={trips} tripsLoading={tripsLoading} onNewTrip={() => setModalOpen(true)} onSelect={(trip: DbTrip) => openTripDetails(trip.id)} />
        )}
        {active === 'Discover' && (
          <DiscoverPage destinations={cities} citiesLoading={citiesLoading} query={query} setQuery={setQuery} favorites={favorites} toggleFavorite={toggleFavorite} />
        )}
        {active === 'Budget' && (
          <BudgetPage trips={trips} selectedTripId={selectedTripId} onSelectTrip={openTripDetails} budget={budget} budgetError={budgetError} totalSpent={totalSpent} />
        )}
        {active === 'Settings' && <SettingsPage user={user} onNotice={showNotice} />}
        {active === 'Trip details' && (
          <TripDetailsPage
            detail={tripDetail} onNotice={showNotice} onAddStop={() => setStopModalOpen(true)} onShare={() => selectedTripId && shareTrip(selectedTripId)}
            expandedStopId={expandedStopId} onToggleStop={(id: string) => setExpandedStopId((current) => (current === id ? null : id))}
            onRemoveStop={removeStop} onAddActivity={openActivityModal} onRemoveActivity={removeActivity}
            draggedStopId={draggedStopId} onDragStart={setDraggedStopId} onDrop={handleStopDrop}
          />
        )}
      </section>

      {isModalOpen && (
        <Modal title="Where will you go next?" onClose={() => setModalOpen(false)}>
          <form onSubmit={addTrip}>
            <p className="muted">Give the trip a name and the dates you're travelling.</p>
            <label>Trip name<input name="name" autoFocus placeholder="e.g. Two weeks in South Korea" /></label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label style={{ flex: 1 }}>Start date<input name="startDate" type="date" required /></label>
              <label style={{ flex: 1 }}>End date<input name="endDate" type="date" required /></label>
            </div>
            <label>Description (optional)<input name="description" placeholder="What's this trip about?" /></label>
            <label>Budget goal (optional)<input name="budgetAmount" type="number" min="0" step="1" placeholder="e.g. 2500" /></label>
            <button className="primary-button modal-submit" type="submit">Start planning <ArrowUpRight size={17} /></button>
          </form>
        </Modal>
      )}

      {isStopModalOpen && (
        <Modal title="Add a stop" onClose={() => setStopModalOpen(false)}>
          <form onSubmit={addStop}>
            <p className="muted">Pick a city and the dates you'll be there.</p>
            <label>
              City
              <select name="cityId" defaultValue="" required>
                <option value="" disabled>Select a city</option>
                {cities.map((city) => <option key={city.id} value={city.id}>{city.name}, {city.country}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label style={{ flex: 1 }}>Start date<input name="startDate" type="date" required /></label>
              <label style={{ flex: 1 }}>End date<input name="endDate" type="date" required /></label>
            </div>
            <button className="primary-button modal-submit" type="submit">Add stop <ArrowUpRight size={17} /></button>
          </form>
        </Modal>
      )}

      {activityModalStop && (
        <Modal title={`Add an activity in ${activityModalStop.city_name}`} onClose={() => setActivityModalStop(null)}>
          {activityCatalogLoading ? (
            <p className="muted">Loading activities…</p>
          ) : activityCatalog.length === 0 ? (
            <p className="muted">No activities found for {activityModalStop.city_name} yet.</p>
          ) : (
            <form onSubmit={addActivityToStop}>
              <label>
                Activity
                <select name="activityId" defaultValue="" required onChange={(event) => {
                  const picked = activityCatalog.find((a) => a.id === event.target.value)
                  const costInput = event.currentTarget.form?.elements.namedItem('cost') as HTMLInputElement | null
                  if (picked && costInput && !costInput.dataset.touched) costInput.value = picked.default_cost
                  setPendingActivityCost(Number(costInput?.value ?? 0) || 0)
                }}>
                  <option value="" disabled>Select an activity</option>
                  {activityCatalog.map((activity) => (
                    <option key={activity.id} value={activity.id}>{activity.name} · {activity.category}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ flex: 1 }}>
                  Date
                  <input name="date" type="date" min={activityModalStop.start_date.slice(0, 10)} max={activityModalStop.end_date.slice(0, 10)} required />
                </label>
                <label style={{ flex: 1 }}>Start time<input name="startTime" type="time" required /></label>
              </div>
              <label>Cost<input name="cost" type="number" min={0} step="0.01" defaultValue={0} onChange={(event) => { event.currentTarget.dataset.touched = 'true'; setPendingActivityCost(Number(event.currentTarget.value) || 0) }} /></label>
              <label>Notes (optional)<input name="notes" placeholder="Booking reference, meeting point…" /></label>
              {budget?.budgetAmount != null && budget.total + pendingActivityCost > budget.budgetAmount && (
                <p className="over-budget-banner">
                  Adding this would push you ${Math.round(budget.total + pendingActivityCost - budget.budgetAmount).toLocaleString()} over your ${budget.budgetAmount.toLocaleString()} budget.
                </p>
              )}
              <button className="primary-button modal-submit" type="submit">Add activity <ArrowUpRight size={17} /></button>
            </form>
          )}
        </Modal>
      )}
    </main>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="new-trip-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
        <div className="modal-icon"><Sparkles size={20} /></div>
        <p className="eyebrow">GlobeTrotter workspace</p>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function Overview({ trips, tripsLoading, destinations, favorites, toggleFavorite, view, setView, calendarOffset, setCalendarOffset, onNewTrip, onNavigate, onNotice, onOpenTrip }: any) {
  const trip: DbTrip | undefined = trips[0]
  const monthLabel = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() + calendarOffset)
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }, [calendarOffset])

  return (
    <div className="page-content">
      <div className="page-heading">
        <div><p className="eyebrow">Your travel desk</p><h1>Make room for <em>somewhere new.</em></h1><p className="heading-copy">Keep your plans in one place, then leave space for the unexpected.</p></div>
        <button className="primary-button" onClick={onNewTrip}><Plus size={18} /> Plan a new trip</button>
      </div>

      <div className="dashboard-grid">
        <section className="main-column">
          {tripsLoading ? (
            <p className="muted">Loading your trips…</p>
          ) : !trip ? (
            <div className="hero-trip-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
              <div style={{ textAlign: 'center' }}>
                <p className="muted">No trips yet — plan your first one.</p>
                <button className="primary-button" style={{ marginTop: '0.75rem' }} onClick={onNewTrip}><Plus size={16} /> Plan a trip</button>
              </div>
            </div>
          ) : (
            <>
              <div className="section-header">
                <div><p className="eyebrow">Next adventure</p><h2>{tripPrimaryLocation(trip)}</h2><p className="muted">{formatRange(trip.start_date, trip.end_date)}</p></div>
                <button className="text-button" onClick={() => onOpenTrip(trip.id)}>Open itinerary <ArrowUpRight size={16} /></button>
              </div>
              <button className="hero-trip-card" onClick={() => onOpenTrip(trip.id)}>
                <img src={trip.cover_photo || FALLBACK_IMAGE} alt={`${trip.name} travel view`} />
                <div className="hero-overlay">
                  <span className="status-pill"><span /> {tripStatus(trip)}</span>
                  <div className="hero-info">
                    <div><p className="hero-kicker">Trip window</p><h3>{tripDurationDays(trip)} days</h3></div>
                    <div className="trip-location"><MapPin size={16} /> {trip.name}</div>
                  </div>
                </div>
              </button>
              <div className="stat-row">
                <div className="stat-card"><div className="stat-icon stat-icon-coral"><CalendarDays size={18} /></div><div><small>Trip duration</small><strong>{tripDurationDays(trip)} days</strong><span>{formatRange(trip.start_date, trip.end_date)}</span></div></div>
                <div className="stat-card"><div className="stat-icon stat-icon-blue"><Ticket size={18} /></div><div><small>Stops planned</small><strong>{trip.stops?.length ?? 0}</strong><span>cities on the route</span></div></div>
                <div className="stat-card"><div className="stat-icon stat-icon-yellow"><CircleDollarSign size={18} /></div><div><small>Trip budget</small><strong>View budget</strong><span className="positive"><button className="text-button" onClick={() => onNavigate('Budget')}>See breakdown</button></span></div></div>
              </div>
              <div className="section-header itinerary-header">
                <div><p className="eyebrow">On the itinerary</p><h2>Stops</h2></div>
                <div className="view-toggle">
                  <button className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')} aria-label="List view"><List size={17} /></button>
                  <button className={view === 'grid' ? 'selected' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={16} /></button>
                </div>
              </div>
              <div className={`timeline ${view === 'grid' ? 'timeline-grid' : ''}`}>
                {(trip.stops ?? []).length === 0 && <p className="muted">No stops added to this trip yet.</p>}
                {(trip.stops ?? []).map((stop: DbStop) => (
                  <div className="timeline-item" key={stop.id}>
                    <div className="timeline-time">{formatDate(stop.startDate)}</div>
                    <div className="timeline-marker marker-teal">✦</div>
                    <div className="timeline-card"><div><h4>{stop.city.name}, {stop.city.country}</h4><p>{formatRange(stop.startDate, stop.endDate)}</p></div><ChevronRight size={17} /></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="right-column">
          <div className="mini-calendar">
            <div className="calendar-heading">
              <div><p className="eyebrow">{monthLabel}</p><h3>Your month at a glance</h3></div>
              <div className="calendar-arrows">
                <button aria-label="Previous month" onClick={() => setCalendarOffset((current: number) => current - 1)}><ChevronLeft size={16} /></button>
                <button aria-label="Next month" onClick={() => setCalendarOffset((current: number) => current + 1)}><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="calendar-weekdays">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
            <div className="calendar-days">
              {Array.from({ length: 35 }, (_, index) => {
                const day = index - 2
                return (
                  <button type="button" key={index} className={day < 1 || day > 31 ? 'calendar-muted' : ''} onClick={() => onNotice(day > 0 && day < 32 ? `${monthLabel.split(' ')[0]} ${day} selected` : 'No date selected')}>
                    {day > 0 && day < 32 ? day : ''}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="people-card">
            <div className="section-header compact">
              <div><p className="eyebrow">Travelling with</p><h3>Make it a group trip</h3></div>
              <Users size={20} />
            </div>
            <p className="muted" style={{ fontSize: '0.85rem' }}>Collaborator invites aren't available yet — coming soon.</p>
          </div>
        </aside>
      </div>

      <section className="discover-section">
        <div className="section-header">
          <div><p className="eyebrow">Keep exploring</p><h2>Places with a point of view</h2></div>
          <button className="text-button" onClick={() => onNavigate('Discover')}>See all destinations <ArrowUpRight size={16} /></button>
        </div>
        <div className="destination-grid">
          {destinations.slice(0, 3).map((destination: DbCity) => (
            <article className="destination-card" key={destination.id}>
              <div className="destination-image">
                <img src={destination.image_url || FALLBACK_IMAGE} alt={`${destination.name}, ${destination.country}`} />
                <button className={`favorite-button ${favorites.includes(destination.id) ? 'is-favorite' : ''}`} aria-label={`Favorite ${destination.name}`} onClick={() => toggleFavorite(destination.id)}>
                  <Heart size={17} fill={favorites.includes(destination.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="destination-details">
                <div><h3>{destination.name}</h3><p>{destination.country} <span>·</span> {destination.region ?? 'Popular'}</p></div>
                <ArrowUpRight size={17} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function TripsPage({ trips, tripsLoading, onNewTrip, onSelect }: any) {
  return (
    <div className="page-content">
      <div className="page-heading">
        <div><p className="eyebrow">Your collection</p><h1>Every trip, <em>in one place.</em></h1><p className="heading-copy">Revisit the details and make the next departure easy.</p></div>
        <button className="primary-button" onClick={onNewTrip}><Plus size={18} /> Plan a new trip</button>
      </div>
      {tripsLoading ? <p className="muted">Loading…</p> : trips.length === 0 ? <p className="muted">No trips yet. Plan your first one above.</p> : (
        <div className="trip-library">
          {trips.map((trip: DbTrip) => {
            const budgetAmount = trip.budget_amount != null ? Number(trip.budget_amount) : null
            const totalSpent = trip.total_spent != null ? Number(trip.total_spent) : 0
            const isOverBudget = budgetAmount != null && totalSpent > budgetAmount
            return (
              <button className="library-trip" key={trip.id} onClick={() => onSelect(trip)}>
                <img src={trip.cover_photo || FALLBACK_IMAGE} alt={`${trip.name} travel view`} />
                <div>
                  <span className="status-pill"><span /> {tripStatus(trip)}</span>
                  {isOverBudget && (
                    <span className="status-pill over-budget-pill"><span /> Over budget</span>
                  )}
                  <h2>{trip.name}</h2>
                  <p>{formatRange(trip.start_date, trip.end_date)}</p>
                  <small>{trip.stops?.length ?? 0} stops · View itinerary <ArrowUpRight size={14} /></small>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DiscoverPage({ destinations, citiesLoading, query, setQuery, favorites, toggleFavorite }: any) {
  return (
    <div className="page-content">
      <div className="page-heading">
        <div><p className="eyebrow">Curated for you</p><h1>Find your <em>next point of view.</em></h1><p className="heading-copy">Search places that reward curiosity, good taste, and a little wandering.</p></div>
      </div>
      <div className="discover-toolbar">
        <div className="search-box wide"><Search size={17} /><input aria-label="Search places" placeholder="Search places or countries" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </div>
      {citiesLoading ? <p className="muted">Loading destinations…</p> : destinations.length === 0 ? <p className="muted">No destinations matched your search.</p> : (
        <div className="destination-grid destination-grid-large">
          {destinations.map((destination: DbCity) => (
            <article className="destination-card" key={destination.id}>
              <div className="destination-image">
                <img src={destination.image_url || FALLBACK_IMAGE} alt={`${destination.name}, ${destination.country}`} />
                <button className={`favorite-button ${favorites.includes(destination.id) ? 'is-favorite' : ''}`} aria-label={`Favorite ${destination.name}`} onClick={() => toggleFavorite(destination.id)}>
                  <Heart size={17} fill={favorites.includes(destination.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="destination-details">
                <div><h3>{destination.name}</h3><p>{destination.country} <span>·</span> cost index {destination.cost_index}</p></div>
                <ArrowUpRight size={17} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function BudgetPage({ trips, selectedTripId, onSelectTrip, budget, budgetError, totalSpent }: any) {
  const categories = budget ? Object.entries(budget.byCategory) as [string, number][] : []
  const categoryChartData = categories.map(([name, value]) => ({ name, value }))
  const cities = budget?.byCity ?? []
  const byDay = budget?.byDay ?? []

  const hasGoal = budget?.budgetAmount != null
  const percentUsed = budget?.percentUsed ?? 0
  const barPercent = Math.min(100, percentUsed)
  const isOverBudget = budget?.isOverBudget ?? false

  // Flag the specific day whose activities first pushed cumulative spend past the goal,
  // and any day where spend was unusually high vs the trip's daily average.
  const dayAlerts = useMemo(() => {
    if (byDay.length === 0) return []
    const budgetAmount = budget?.budgetAmount ?? null
    const avg = budget?.averagePerDay ?? 0
    let running = 0
    let crossed = false
    const alerts: { date: string; total: number; reason: string }[] = []
    for (const row of byDay) {
      running += row.total
      if (budgetAmount != null && !crossed && running > budgetAmount) {
        crossed = true
        alerts.push({ date: row.date, total: row.total, reason: `Cumulative spend crossed your $${budgetAmount.toLocaleString()} goal on this day` })
      } else if (avg > 0 && row.total > avg * 2) {
        alerts.push({ date: row.date, total: row.total, reason: `Spent ${Math.round(row.total / avg)}x your daily average` })
      }
    }
    return alerts
  }, [byDay, budget?.budgetAmount, budget?.averagePerDay])

  return (
    <div className="page-content budget-page">
      <div className="page-heading budget-heading">
        <div><p className="eyebrow">Trip budget</p><h1>Your trip, <em>in balance.</em></h1><p className="heading-copy">Costs come straight from the activities you've added to each stop.</p></div>
      </div>

      <div className="discover-toolbar">
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
          Trip
          <select value={selectedTripId ?? ''} onChange={(event) => event.target.value && onSelectTrip(event.target.value)}>
            <option value="" disabled>Select a trip</option>
            {trips.map((trip: DbTrip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
          </select>
        </label>
      </div>

      {!selectedTripId ? (
        <p className="muted">Pick a trip above to see its budget breakdown.</p>
      ) : budgetError ? (
        <div className="notice-banner" style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>
          {budgetError}
        </div>
      ) : !budget ? (
        <p className="muted">Loading budget…</p>
      ) : (
        <>
          <div className="budget-page-grid">
            <section className="budget-breakdown-panel">
              <div className="section-header"><div><p className="eyebrow">Where it goes</p><h2>Spending by category</h2></div></div>

              {isOverBudget && (
                <div className="notice-banner" style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  Over budget by ${Math.abs(budget.remaining).toLocaleString()} — planned spend has passed your ${budget.budgetAmount.toLocaleString()} goal.
                </div>
              )}

              <div className="budget-total"><strong>${totalSpent.toLocaleString()}</strong><span>total planned spend</span></div>

              {hasGoal && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="category-label" style={{ marginBottom: '0.35rem' }}>
                    <span>Goal: <strong>${budget.budgetAmount.toLocaleString()}</strong></span>
                    <b style={{ color: isOverBudget ? '#dc2626' : undefined }}>{percentUsed}% used</b>
                  </div>
                  <div className="category-track">
                    <span style={{ width: `${barPercent}%`, background: isOverBudget ? '#dc2626' : undefined }} />
                  </div>
                  <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
                    {isOverBudget
                      ? `$${Math.abs(budget.remaining).toLocaleString()} over goal`
                      : `$${budget.remaining.toLocaleString()} remaining · ~$${budget.averagePerDay.toLocaleString()}/day over ${budget.tripDays} days`}
                  </p>
                </div>
              )}

              <CategoryPieChart data={categoryChartData} />
            </section>

            <section className="budget-breakdown-panel">
              <div className="section-header"><div><p className="eyebrow">Where it's spent</p><h2>Spending by city</h2></div></div>
              <CityBarChart data={cities} />
            </section>
          </div>

          <div className="budget-page-grid" style={{ marginTop: '1.25rem' }}>
            <section className="budget-breakdown-panel">
              <div className="section-header"><div><p className="eyebrow">Stop by stop</p><h2>Spending along the route</h2></div></div>
              {(budget.byStop ?? []).length === 0 ? (
                <p className="muted">Add stops to see a per-stop breakdown.</p>
              ) : (
                <div className="stop-budget-list">
                  {budget.byStop.map((stop: Budget['byStop'][number]) => {
                    const share = budget.total > 0 ? Math.round((stop.total / budget.total) * 100) : 0
                    return (
                      <div className="stop-budget-row" key={stop.stopId}>
                        <div className="stop-budget-info">
                          <strong>{stop.city}, {stop.country}</strong>
                          <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.78rem' }}>
                            {formatRange(stop.startDate, stop.endDate)} · {stop.activityCount} {stop.activityCount === 1 ? 'activity' : 'activities'}
                          </p>
                          <div className="category-track" style={{ marginTop: '0.5rem' }}>
                            <span style={{ width: `${share}%` }} />
                          </div>
                        </div>
                        <b>${stop.total.toLocaleString()}</b>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="budget-breakdown-panel">
              <div className="section-header"><div><p className="eyebrow">Over time</p><h2>Cumulative spend</h2></div></div>
              <DailySpendChart data={byDay} budgetAmount={budget.budgetAmount} />
            </section>
          </div>

          <div className="budget-page-grid" style={{ marginTop: '1.25rem' }}>
            <section className="budget-breakdown-panel">
              <div className="section-header"><div><p className="eyebrow">Heads up</p><h2>Budget alerts</h2></div></div>
              {dayAlerts.length === 0 ? (
                <p className="muted">No unusual spending days detected.</p>
              ) : (
                <div className="budget-alert-list">
                  {dayAlerts.map((alert, i) => (
                    <div className="budget-alert-row" key={i}>
                      <div>
                        <strong>{new Date(alert.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong>
                        <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.78rem' }}>{alert.reason}</p>
                      </div>
                      <b style={{ color: '#dc2626' }}>${alert.total.toLocaleString()}</b>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function SettingsPage({ user, onNotice }: any) {
  return (
    <div className="page-content">
      <div className="page-heading">
        <div><p className="eyebrow">Your preferences</p><h1>Make GlobeTrotter <em>feel like yours.</em></h1><p className="heading-copy">Control notifications, profile details, and shared trip preferences.</p></div>
      </div>
      <div className="settings-grid">
        <section className="settings-panel">
          <div className="settings-profile">
            <div className="profile-avatar">{(user?.name ?? '?').slice(0, 2).toUpperCase()}</div>
            <div><h2>{user?.name}</h2><p className="muted">{user?.email}</p></div>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>Profile editing isn't connected to the database yet — this is on the roadmap.</p>
        </section>
        <section className="settings-panel settings-about">
          <p className="eyebrow">About your account</p>
          <h2>Travel slowly. Notice more.</h2>
          <p className="muted">GlobeTrotter keeps the logistics together so the experience can stay open-ended.</p>
        </section>
      </div>
    </div>
  )
}

function TripDetailsPage({
  detail, onAddStop, onShare, expandedStopId, onToggleStop, onRemoveStop, onAddActivity, onRemoveActivity,
  draggedStopId, onDragStart, onDrop,
}: any) {
  if (!detail) return <div className="page-content"><p className="muted">Loading trip…</p></div>
  const { trip, stops, activities } = detail as TripDetail
  const activitiesByStop = activities.reduce<Record<string, TripDetailActivity[]>>((acc, activity) => {
    (acc[activity.stop_id] ??= []).push(activity)
    return acc
  }, {})
  const totalActivityCost = activities.reduce((sum, a) => sum + Number(a.cost), 0)

  return (
    <div className="page-content">
      <div className="page-heading">
        <div><p className="eyebrow">Trip workspace</p><h1>{trip.name}, <em>day by day.</em></h1><p className="heading-copy">Drag stops to reorder, then fill each one in with activities.</p></div>
        <button className="primary-button" onClick={onShare}><Share2 size={18} /> {trip.is_public ? 'Copy share link' : 'Share trip'}</button>
      </div>

      {trip.is_public && trip.share_slug && (
        <p className="muted" style={{ marginBottom: '1rem' }}>Public at <code>/trip/{trip.share_slug}</code></p>
      )}

      <div className="trip-detail-hero">
        <img src={trip.cover_photo || FALLBACK_IMAGE} alt="Trip destination" />
        <div>
          <span className="status-pill"><span /> {tripStatus(trip)}</span>
          <h2>{trip.name}</h2>
          <p>{formatRange(trip.start_date, trip.end_date)}</p>
        </div>
      </div>

      <div className="detail-columns">
        <section className="day-list">
          <div className="section-header">
            <div><p className="eyebrow">Your itinerary</p><h2>{stops.length} stop{stops.length === 1 ? '' : 's'} mapped out</h2></div>
            <button className="text-button" onClick={onAddStop}><Plus size={16} /> Add stop</button>
          </div>
          {stops.length === 0 && <p className="muted">No stops yet — add the first city on this trip.</p>}
          {stops.map((stop: TripDetailStop) => {
            const stopActivities = activitiesByStop[stop.id] ?? []
            const expanded = expandedStopId === stop.id
            return (
              <div
                key={stop.id}
                className={`itinerary-stop ${draggedStopId === stop.id ? 'itinerary-stop-dragging' : ''}`}
                draggable
                onDragStart={() => onDragStart(stop.id)}
                onDragOver={(event: React.DragEvent) => event.preventDefault()}
                onDrop={() => onDrop(stop.id)}
              >
                <div className="day-row" style={{ marginBottom: 0, cursor: 'pointer' }} onClick={() => onToggleStop(stop.id)}>
                  <span className="drag-handle" onClick={(event) => event.stopPropagation()}><GripVertical size={16} /></span>
                  <div style={{ flex: 1 }}>
                    <strong>{stop.city_name}, {stop.city_country}</strong>
                    <small style={{ display: 'block' }}>{formatRange(stop.start_date, stop.end_date)} · {stopActivities.length} activit{stopActivities.length === 1 ? 'y' : 'ies'}</small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      className="icon-button" aria-label="Remove stop"
                      onClick={(event) => { event.stopPropagation(); onRemoveStop(stop.id) }}
                    ><Trash2 size={16} /></button>
                    <ChevronDown size={18} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }} />
                  </div>
                </div>

                {expanded && (
                  <div className="itinerary-stop-body">
                    {stopActivities.length === 0 && <p className="muted" style={{ margin: '12px 0' }}>No activities yet for this stop.</p>}
                    {stopActivities
                      .slice()
                      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
                      .map((activity) => (
                        <div className="activity-row" key={activity.id}>
                          <span className="activity-time"><Clock size={13} /> {formatDate(activity.date)} · {activity.start_time}</span>
                          <div style={{ flex: 1 }}>
                            <strong>{activity.activity_name}</strong>
                            <small style={{ display: 'block' }}>{activity.category}{activity.notes ? ` · ${activity.notes}` : ''}</small>
                          </div>
                          <strong>${Number(activity.cost).toFixed(0)}</strong>
                          <button className="icon-button" aria-label="Remove activity" onClick={() => onRemoveActivity(stop.id, activity.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    <button className="text-button" style={{ marginTop: '10px' }} onClick={() => onAddActivity(stop)}>
                      <Plus size={15} /> Add activity
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </section>
        <aside className="trip-notes">
          <p className="eyebrow">Trip notes</p>
          <h2>Leave a little room.</h2>
          <p className="muted">The best moments might not be on the list yet.</p>
          {activities.length > 0 && (
            <p className="muted" style={{ marginTop: '14px' }}>Activities booked so far total <strong>${totalActivityCost.toFixed(0)}</strong>.</p>
          )}
        </aside>
      </div>
    </div>
  )
}