import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { loginSchema } from '@/lib/validation/schemas'
import { verifyPassword, createSession } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const parsed = loginSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { email, password } = parsed.data

    const user = await queryOne<{ id: string; name: string; email: string; password_hash: string }>(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email]
    )
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }
    await createSession(user.id)
    return NextResponse.json({ id: user.id, name: user.name, email: user.email })
  } catch (error) {
    console.error('POST /api/auth/login failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}