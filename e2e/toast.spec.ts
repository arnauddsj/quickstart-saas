// docs/testing.md
import { expect, test } from '@playwright/test'

test('a failed sign-in shows a styled toast, fixed in the top-right corner', async ({ page }) => {
  await page.route('**/api/auth/sign-in/magic-link', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: '{"message":"Mail relay down"}',
    }),
  )
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('toast@example.com')
  await page.getByRole('button', { name: /send/i }).click()

  const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Mail relay down' })
  await expect(toast).toBeVisible()

  const toaster = page.locator('[data-sonner-toaster]')
  expect(await toaster.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
  const box = await toast.boundingBox()
  const viewport = page.viewportSize()!
  expect(box!.y).toBeLessThan(viewport.height / 2)
  expect(box!.x).toBeGreaterThan(viewport.width / 2)
})
