import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ user: null })
  const user = await queryOne('SELECT id, name, email, photo_url FROM users WHERE id = $1', [userId])
  return NextResponse.json({ user })
}
