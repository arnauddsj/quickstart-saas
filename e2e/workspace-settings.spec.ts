// docs/organizations.md
import { expect, test } from '@playwright/test'
import { brand, signUp } from './onboarding'

test('rename a workspace, see sessions, then delete the workspace', async ({ page }) => {
  test.skip(!brand.teams, 'workspace settings are hidden in solo mode')
  await signUp(page, `settings-${Date.now()}@example.com`, 'Before Rename')

  await page.goto('/settings/organization')
  await page.getByLabel('Name', { exact: true }).fill('After Rename')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'After Rename' })).toBeVisible()
  await expect(page.getByRole('button', { name: `Leave ${brand.workspace.one}` })).toBeDisabled()

  await page.goto('/settings/account')
  await expect(page.getByText('This device')).toBeVisible()

  await page.goto('/settings/organization')
  await page.getByRole('button', { name: `Delete ${brand.workspace.one}` }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Delete forever' })).toBeDisabled()
  await dialog.getByLabel('Confirmation').fill('After Rename')
  await dialog.getByRole('button', { name: 'Delete forever' }).click()
  await page.waitForURL(/\/onboarding/)
})
