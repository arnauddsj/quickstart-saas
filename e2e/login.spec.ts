// docs/email.md
import { expect, test } from '@playwright/test'

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

test('magic link sign-in, onboarding, dashboard', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByRole('button', { name: /send/i }).click()
  await expect(page.getByText(/check your inbox/i)).toBeVisible()

  const link = await waitForMagicLink(email)
  await page.goto(link)

  await page.waitForURL(/\/onboarding/)
  await page.getByLabel(/organization name/i).fill('E2E Org')
  await page.getByRole('button', { name: /create/i }).click()

  await page.waitForURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'E2E Org' })).toBeVisible()
})
