import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'

function makeSlug(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
  const suffix = randomBytes(4).toString('hex')
  return `${base || 'trip'}-${suffix}`
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await queryOne<{ id: string; name: string; share_slug: string | null }>(
    'SELECT id, name, share_slug FROM trips WHERE id = $1 AND owner_id = $2',
    [id, userId]
  )
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const slug = trip.share_slug ?? makeSlug(trip.name)
  const updated = await queryOne<{ share_slug: string; is_public: boolean }>(
    'UPDATE trips SET is_public = TRUE, share_slug = $2 WHERE id = $1 RETURNING share_slug, is_public',
    [id, slug]
  )
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await queryOne('SELECT id FROM trips WHERE id = $1 AND owner_id = $2', [id, userId])
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await queryOne('UPDATE trips SET is_public = FALSE WHERE id = $1 RETURNING id', [id])
  return NextResponse.json({ ok: true })
}
