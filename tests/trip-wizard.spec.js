import { expect, test } from '@playwright/test'
import { mockExternalRequests } from './network'

test.beforeEach(async ({ page, baseURL }) => {
  await mockExternalRequests(page, baseURL)
  await page.addInitScript(() => localStorage.setItem('rumbo-language', 'en'))
})

test('creates a trip from endpoints and multiple stays', async ({ page }) => {
  await page.goto('./')

  const tripMenu = page.getByRole('button', { name: 'Trips', exact: true })
  await tripMenu.click()
  await page.getByRole('menuitem', { name: 'New trip', exact: true }).click()

  const wizard = page.getByRole('dialog', { name: 'Create a new trip' })
  await expect(wizard).toBeVisible()
  await wizard.getByRole('textbox', { name: 'Trip name' }).fill('World cities')
  await wizard
    .getByRole('textbox', { name: 'Starting point: City or place' })
    .fill('Seattle, WA')
  await wizard.getByLabel('Starting point: Date').fill('2027-04-01')
  await wizard
    .getByRole('textbox', { name: 'Final point: City or place' })
    .fill('Paris')
  await wizard.getByLabel('Final point: Date').fill('2027-04-10')
  await wizard.getByRole('button', { name: 'Continue' }).click()

  await wizard
    .getByRole('textbox', { name: 'Stay 1: City or place' })
    .fill('Tokyo')
  await wizard.getByLabel('Stay 1: Arrival').fill('2027-04-01')
  await wizard.getByLabel('Stay 1: Departure').fill('2027-04-05')
  await wizard.getByRole('button', { name: 'Add another stay' }).click()
  await wizard
    .getByRole('textbox', { name: 'Stay 2: City or place' })
    .fill('Paris')
  await wizard.getByLabel('Stay 2: Arrival').fill('2027-04-05')
  await wizard.getByLabel('Stay 2: Departure').fill('2027-04-10')
  await wizard.getByRole('button', { name: 'Finish' }).click()

  await expect(wizard).toBeHidden()
  await expect(page.getByRole('textbox', { name: 'Trip name' })).toHaveValue(
    'World cities',
  )
  await expect(page.locator('.stop-node:not(.is-nested)')).toHaveCount(2)
  await expect(page.locator('.timeline-stop')).toHaveCount(2)
  await expect(page.getByText('Map updated automatically.')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const library = JSON.parse(
          localStorage.getItem('rumbo-trip-library-v1'),
        )
        const trip = library.trips.find(
          (candidate) => candidate.id === library.activeTripId,
        )
        return {
          title: trip.title,
          origin: trip.origin.place,
          destination: trip.destination.place,
          stays: trip.draftStops.map((stay) => stay.place),
        }
      }),
    )
    .toEqual({
      title: 'World cities',
      origin: 'Seattle, WA',
      destination: 'Paris',
      stays: ['Tokyo', 'Paris'],
    })
})

test('cancels without creating a trip', async ({ page }) => {
  await page.goto('./')

  const tripMenu = page.getByRole('button', { name: 'Trips', exact: true })
  await tripMenu.click()
  await page.getByRole('menuitem', { name: 'New trip', exact: true }).click()

  const wizard = page.getByRole('dialog', { name: 'Create a new trip' })
  await wizard.getByRole('textbox', { name: 'Trip name' }).fill('Discard me')
  await wizard.getByRole('button', { name: 'Cancel', exact: true }).click()

  await expect(wizard).toBeHidden()
  await expect(tripMenu).toContainText('1')
  await expect(page.getByRole('textbox', { name: 'Trip name' })).toHaveValue(
    'México 2027',
  )
})
