// docs/admin.md
import { expect, test } from '@playwright/test'
import { completeOnboarding } from './onboarding'

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025'

async function waitForMagicLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    )
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    const first = messages[0]
    if (first) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${first.ID}`)
      const { Text } = (await message.json()) as { Text: string }
      const match = Text.match(/https?:\/\/\S+magic-link\/verify\S+/)
      if (match) return match[0]
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no magic link for ${email} in Mailpit`)
}

test('the first account is the admin and sees the admin overview', async ({ page }) => {
  const email = `admin-e2e-${Date.now()}@example.com`
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByRole('button', { name: /send/i }).click()
  await page.goto(await waitForMagicLink(email))
  await page.waitForURL(/\/onboarding/)

  const me = await page.evaluate(async () => {
    const res = await fetch('/trpc/user.me', { credentials: 'include' })
    return (await res.json()).result.data as { role: string }
  })
  test.skip(me.role !== 'admin', 'database already has users; the first account is the admin')

  await completeOnboarding(page, 'Admin Org')

  await page.getByRole('link', { name: 'Overview' }).click()
  await page.waitForURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
  await expect(page.getByText('Users', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()

  await page.getByRole('link', { name: 'Manage users' }).click()
  await page.waitForURL(/\/admin\/users/)
  await expect(page.getByRole('cell', { name: email })).toBeVisible()
})
