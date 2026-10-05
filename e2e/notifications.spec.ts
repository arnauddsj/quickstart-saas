// docs/notifications.md
import { expect, test } from '@playwright/test'
import { brand, signUp } from './onboarding'

test('a new account is greeted in the bell, and opening it clears the badge', async ({ page }) => {
  await signUp(page, `bell-${Date.now()}@example.com`, 'Bell Org')

  const bell = page.getByRole('button', { name: /^Notifications/ })
  await expect(bell).toHaveAccessibleName('Notifications, 1 unread')
  await bell.click()
  await page.getByRole('menuitem', { name: new RegExp(`Welcome to ${brand.name}`) }).click()
  await expect(bell).toHaveAccessibleName('Notifications')
})
