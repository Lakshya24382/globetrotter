import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { signupSchema } from '@/lib/validation/schemas'
import { hashPassword, createSession } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const parsed = signupSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { name, email, password } = parsed.data

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email])
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

    const passwordHash = await hashPassword(password)
    const user = await queryOne<{ id: string; name: string; email: string }>(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, passwordHash]
    )
    await createSession(user!.id)
    return NextResponse.json(user)
  } catch (error) {
    console.error('POST /api/auth/signup failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}