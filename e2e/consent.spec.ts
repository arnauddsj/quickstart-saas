// docs/consent.md
import { expect, test } from '@playwright/test'

const VENDOR_HOSTS = /googletagmanager\.com|clarity\.ms|google-analytics\.com/

test.skip(!process.env.VITE_GA4_ID, 'set VITE_GA4_ID to exercise the consent banner')

test('nothing loads before consent, vendors load after accepting', async ({ page }) => {
  const vendorRequests: string[] = []
  page.on('request', (request) => {
    if (VENDOR_HOSTS.test(request.url())) vendorRequests.push(request.url())
  })

  await page.goto('/login')
  await expect(page.getByRole('button', { name: /refuse all/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /accept all/i })).toBeVisible()
  await page.waitForTimeout(1000)
  expect(vendorRequests).toEqual([])

  await page.getByRole('button', { name: /refuse all/i }).click()
  await page.reload()
  await page.waitForTimeout(1000)
  await expect(page.getByRole('button', { name: /refuse all/i })).toHaveCount(0)
  expect(vendorRequests).toEqual([])

  await page.getByRole('button', { name: /^cookies$/i }).click()
  await page.getByRole('button', { name: /accept all/i }).click()
  await expect.poll(() => vendorRequests.length, { timeout: 10_000 }).toBeGreaterThan(0)
})
