// docs/organizations.md
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { brand, completeOnboarding } from './onboarding'

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025'

async function link(to: string, pattern: RegExp): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    )
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    for (const { ID } of messages) {
      const { Text } = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${ID}`)).json()) as {
        Text: string
      }
      const match = Text.match(pattern)
      if (match) return match[0]
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no mail to ${to} matching ${pattern}`)
}

async function requestLink(page: Page, email: string) {
  await page.getByLabel(/email/i).fill(email)
  await page.getByRole('button', { name: /send/i }).click()
  await expect(page.getByText(/check your inbox/i)).toBeVisible()
}

test('an invited person signs in from the invitation and lands in the organization as a member', async ({
  browser,
}) => {
  test.skip(!brand.teams, 'invitations exist only when brand.teams is on')
  const run = Date.now().toString(36)
  const owner = `owner-${run}@example.com`
  const invitee = `invitee-${run}@example.com`
  const orgName = `Invite Org ${run}`

  const ownerPage = await (await browser.newContext()).newPage()
  await ownerPage.goto('/login')
  await requestLink(ownerPage, owner)
  await ownerPage.goto(await link(owner, /https?:\/\/\S+magic-link\/verify\S+/))
  await completeOnboarding(ownerPage, orgName)
  await ownerPage.goto('/settings/organization')
  await ownerPage.getByPlaceholder('colleague@example.com').fill(invitee)
  await ownerPage.getByRole('button', { name: 'Invite', exact: true }).click()
  await expect(ownerPage.getByText(`Invitation sent to ${invitee}`)).toBeVisible()

  const page = await (await browser.newContext()).newPage()
  await page.goto(await link(invitee, /https?:\/\/\S+accept-invitation\/\S+/))
  await page.waitForURL(/\/login\?redirect=/)
  await requestLink(page, invitee)
  await page.goto(await link(invitee, /https?:\/\/\S+magic-link\/verify\S+/))

  await page.waitForURL(/\/$/)
  await expect(page.getByRole('button', { name: orgName })).toBeVisible()
  await page.goto('/settings/billing')
  await expect(
    page.getByText(`Only owners and admins of this ${brand.workspace.one} can change its plan.`),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /upgrade/i })).toHaveCount(0)
})
