// docs/reference-feature.md
import { expect, test } from '@playwright/test'
import { signUp } from './onboarding'

test('create, rename and delete a project', async ({ page }) => {
  await signUp(page, `projects-${Date.now()}@example.com`, 'Projects Org')

  await page.getByRole('link', { name: 'Projects' }).click()
  await expect(page.getByText('No projects yet')).toBeVisible()

  await page.getByRole('button', { name: 'Create a project' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Alpha')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('cell', { name: 'Alpha' })).toBeVisible()
  await expect(page.getByText('1 of 3 on your plan')).toBeVisible()

  await page.getByRole('button', { name: 'Rename' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Beta')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('cell', { name: 'Beta' })).toBeVisible()

  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No projects yet')).toBeVisible()
})
