import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { profileUpdateSchema } from '@/lib/validation/schemas'

export async function PATCH(req: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = profileUpdateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { name, photoUrl } = parsed.data

  const fields: [string, string | null][] = []
  if (name !== undefined) fields.push(['name', name])
  if (photoUrl !== undefined) fields.push(['photo_url', photoUrl || null])
  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const setClauses = fields.map(([col], i) => `${col} = $${i + 2}`)
  const values = fields.map(([, value]) => value)

  const user = await queryOne(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1 RETURNING id, name, email, photo_url`,
    [userId, ...values]
  )
  return NextResponse.json({ user })
}
