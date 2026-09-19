// docs/branding.md
import { expect, type Page } from '@playwright/test'
import { brand } from '../server/src/config/brand'

export { brand }

export async function completeOnboarding(page: Page, workspaceName: string) {
  await page.waitForURL(/\/onboarding/)
  if (brand.teams) {
    await page.getByLabel(new RegExp(`${brand.workspace.one} name`, 'i')).fill(workspaceName)
    await page.getByRole('button', { name: /create/i }).click()
  } else {
    const start = page.getByRole('button', { name: /get started/i })
    const dashboard = page.getByRole('heading', { name: 'Dashboard' })
    await expect(start.or(dashboard)).toBeVisible()
    if (await start.isVisible()) await start.click()
  }
  await page.waitForURL(/\/$/)
}

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025'

export async function signUp(page: Page, email: string, workspaceName: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByRole('button', { name: /send/i }).click()
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    )
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    if (messages[0]) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)
      const { Text } = (await message.json()) as { Text: string }
      const link = Text.match(/https?:\/\/\S+magic-link\/verify\S+/)?.[0]
      if (link) {
        await page.goto(link)
        return completeOnboarding(page, workspaceName)
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no magic link for ${email} in Mailpit`)
}
