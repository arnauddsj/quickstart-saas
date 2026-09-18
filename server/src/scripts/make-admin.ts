import { eq } from 'drizzle-orm'
import { db, pool } from '../db/client.js'
import { user } from '../db/schema/index.js'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('usage: pnpm make-admin <email>')
  process.exit(1)
}

const existing = await db.query.user.findFirst({ where: eq(user.email, email) })
if (existing) {
  await db.update(user).set({ role: 'admin', emailVerified: true }).where(eq(user.id, existing.id))
  console.log(`${email} is now admin`)
} else {
  await db.insert(user).values({
    id: crypto.randomUUID(),
    email,
    name: email.split('@')[0] ?? email,
    emailVerified: true,
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  console.log(`${email} created as admin; sign in with a magic link`)
}
await pool.end()
